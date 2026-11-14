import { getRawJson, putRawJson } from "../blocks/storage.js";
import { getTmdb } from "../tmdb/client.js";
import {
	type ExtraReview,
	fetchBahamutReviews,
	fetchDoubanReviews,
	scopedReviewTitle,
	type MediaType,
	type ReviewSource,
	type ReviewTitle,
	type ReviewContext,
	type SourceReviews,
} from "./providers.js";

interface SourceSnapshot extends SourceReviews {
	retryAt: number;
}
interface Snapshot {
	version: 1;
	title?: ReviewTitle;
	sources: Partial<Record<ReviewSource, SourceSnapshot>>;
}
export interface ReviewStorage {
	read(key: string): Promise<unknown>;
	write(key: string, value: unknown): Promise<void>;
}
export function reviewStorage(bucket?: R2Bucket): ReviewStorage | null {
	if (bucket)
		return {
			read: async (key) => (await bucket.get(key))?.json() ?? null,
			write: async (key, value) => {
				await bucket.put(key, JSON.stringify(value), {
					httpMetadata: { contentType: "application/json" },
				});
			},
		};
	if (!process.env.R2_ACCESS_KEY_ID) return null;
	return {
		read: async (key) => {
			try {
				return await getRawJson(key);
			} catch (error) {
				if (
					(error as { $metadata?: { httpStatusCode?: number } }).$metadata
						?.httpStatusCode === 404
				)
					return null;
				throw error;
			}
		},
		write: putRawJson,
	};
}

export async function resolveTitle(
	type: MediaType,
	id: number,
	season?: number,
): Promise<ReviewTitle> {
	const details = await Promise.all(
		["zh-CN", "zh-TW"].map(async (language) => {
			const options = {
				params: { path: { movie_id: id, series_id: id }, query: { language } },
				signal: AbortSignal.timeout(6000),
			};
			const result =
				type === "movie"
					? await getTmdb().GET(`/3/movie/${id}`, options)
					: await getTmdb().GET(`/3/tv/${id}`, options);
			if (!result.response.ok || !result.data)
				throw new Error("Review title unavailable");
			return result.data as {
				title?: string;
				name?: string;
				original_title?: string;
				original_name?: string;
				release_date?: string;
				first_air_date?: string;
				genres?: { id?: number }[];
				seasons?: {
					season_number?: number;
					name?: string;
					air_date?: string | null;
				}[];
			};
		}),
	);
	// Series metadata already contains localized season names and premiere dates.
	const seasons = details.map((detail) =>
		detail.seasons?.find((entry) => entry.season_number === season),
	);
	const first = details[0];
	const year = Number(
		(season === undefined
			? (first.release_date ?? first.first_air_date ?? "")
			: (seasons[0]?.air_date ?? "")
		).slice(0, 4),
	);
	const titles = [
		...new Set(
			[
				...details.map((detail) => detail.title ?? detail.name),
				first.original_title ?? first.original_name,
			].filter((value): value is string => !!value),
		),
	];
	if (!titles.length || !year)
		throw new Error("Review title lacks a title or year");
	return scopedReviewTitle(
		{
			type,
			titles,
			year,
			animated: first.genres?.some((genre) => genre.id === 16) ?? false,
		},
		season,
		seasons.flatMap((entry) =>
			entry?.name?.trim() ? [entry.name.trim()] : [],
		),
	);
}

const DAY = 86_400_000;
const SOURCES = ["douban", "bahamut"] as const;

/** Fast cached reads; cold callers may briefly join the shared background crawl. */
export function createReviewCache(
	dependencies = {
		resolveTitle,
		fetchers: { douban: fetchDoubanReviews, bahamut: fetchBahamutReviews },
	},
) {
	const memory = new Map<string, { snapshot: Snapshot; expires: number }>();
	const reads = new Map<string, Promise<Snapshot | null>>();
	const refreshes = new Map<string, Promise<void>>();

	function remember(key: string, snapshot: Snapshot) {
		memory.delete(key);
		const oldest = memory.keys().next().value;
		if (memory.size >= 128 && oldest) memory.delete(oldest);
		// Other isolates may finish the initial crawl while this one holds an empty snapshot.
		const ttl = SOURCES.some(
			(source) => snapshot.sources[source]?.results.length,
		)
			? 300_000
			: 30_000;
		memory.set(key, { snapshot, expires: Date.now() + ttl });
	}

	function read(key: string, storage: ReviewStorage): Promise<Snapshot | null> {
		const cached = memory.get(key);
		if (cached && cached.expires > Date.now())
			return Promise.resolve(cached.snapshot);
		let job = reads.get(key);
		if (!job) {
			if (reads.size >= 128) return Promise.resolve(cached?.snapshot ?? null);
			job = storage
				.read(key)
				.then((raw) => {
					const data = raw as Snapshot | null;
					const snapshot: Snapshot =
						data?.version === 1 && data.sources
							? data
							: { version: 1, sources: {} };
					remember(key, snapshot);
					return snapshot;
				})
				.catch(() => memory.get(key)?.snapshot ?? null)
				.finally(() => reads.delete(key));
			reads.set(key, job);
		}
		return job;
	}

	function refresh(
		key: string,
		type: MediaType,
		id: number,
		storage: ReviewStorage,
		snapshot: Snapshot,
		season?: number,
		context?: ReviewContext,
	): Promise<void> {
		const existing = refreshes.get(key);
		if (existing) return existing;
		// Bound concurrent crawling even if many distinct titles arrive together.
		if (refreshes.size >= 4) return Promise.resolve();
		const due = SOURCES.filter(
			(source) => (snapshot.sources[source]?.retryAt ?? 0) <= Date.now(),
		);
		if (!due.length) return Promise.resolve();
		const job = (async () => {
			const next: Snapshot = {
				version: 1,
				title: snapshot.title,
				sources: { ...snapshot.sources },
			};
			let titleJob: Promise<ReviewTitle> | undefined;
			const verifiedTitle = () =>
				(titleJob ??= (
					snapshot.title
						? Promise.resolve(snapshot.title)
						: dependencies.resolveTitle(type, id, season)
				).then((title) => {
					next.title = title;
					return title;
				}));
			try {
				await Promise.all(
					due.map(async (source) => {
						const previous = snapshot.sources[source];
						try {
							const language = context?.language.toLowerCase() ?? "";
							const useContext =
								context &&
								(previous?.sourceId ||
									(source === "bahamut" && !context.title.animated) ||
									(source === "douban"
										? /^zh(?:-cn|-hans)?$/.test(language)
										: /^zh-(?:tw|hant)$/.test(language)));
							const title = useContext ? context.title : await verifiedTitle();
							let result = await dependencies.fetchers[source](
								title,
								previous?.sourceId,
							);
							if (
								useContext &&
								!previous?.sourceId &&
								!result.sourceId &&
								!(source === "bahamut" && !title.animated)
							) {
								result = await dependencies.fetchers[source](
									await verifiedTitle(),
								);
							}
							next.sources[source] = {
								...result,
								retryAt: Date.now() + (result.sourceId ? DAY : DAY / 4),
							};
						} catch {
							// A blocked or failing source must never erase a working snapshot.
							next.sources[source] = {
								sourceId: previous?.sourceId ?? null,
								results: previous?.results ?? [],
								retryAt: Date.now() + 900_000,
							};
							console.warn(`Reviews refresh failed: ${source} ${type}/${id}`);
						}
						remember(key, next);
					}),
				);
			} catch {
				for (const source of due)
					next.sources[source] = {
						sourceId: snapshot.sources[source]?.sourceId ?? null,
						results: snapshot.sources[source]?.results ?? [],
						retryAt: Date.now() + 900_000,
					};
			}
			remember(key, next);
			await storage.write(key, next);
		})()
			.catch(() => {
				console.warn(`Reviews cache write failed: ${type}/${id}`);
			})
			.finally(() => refreshes.delete(key));
		refreshes.set(key, job);
		return job;
	}

	return async (
		type: MediaType,
		id: number,
		storage: ReviewStorage | null,
		waitUntil: (job: Promise<void>) => void,
		waitForRefreshMs = 0,
		season?: number,
		context?: ReviewContext,
	): Promise<ExtraReview[]> => {
		if (!storage || season === 0) return [];
		const startedAt = performance.now();
		const baseKey = `reviews/v2/${type}/${id}${season === undefined ? "" : `/season/${season}`}.json`;
		// Client hints cannot overwrite the canonical TMDB-verified mapping.
		const digest = context
			? await crypto.subtle.digest(
					"SHA-256",
					new TextEncoder().encode(JSON.stringify(context)),
				)
			: null;
		const fingerprint = digest
			? [...new Uint8Array(digest)]
					.map((byte) => byte.toString(16).padStart(2, "0"))
					.join("")
			: "";
		const key = context ? `${baseKey}/context/${fingerprint}` : baseKey;
		const own = read(key, storage);
		const hasResults = (
			snapshot: Snapshot | null | undefined,
		): snapshot is Snapshot =>
			SOURCES.some((source) => snapshot?.sources[source]?.results.length);
		const canonical = context ? read(baseKey, storage) : own;
		let loadedSnapshot: Snapshot | null = null;
		const loading = (
			context
				? Promise.race([
						own.then((snapshot) =>
							hasResults(snapshot)
								? snapshot
								: canonical.then((fallback) =>
										hasResults(fallback) ? fallback : snapshot,
									),
						),
						canonical.then((snapshot) =>
							hasResults(snapshot) ? snapshot : own,
						),
					])
				: own
		).then((snapshot) => {
			loadedSnapshot = snapshot;
			return snapshot;
		});
		const background = loading.then((snapshot) =>
			snapshot
				? refresh(key, type, id, storage, snapshot, season, context)
				: undefined,
		);
		waitUntil(background);
		let timer: ReturnType<typeof setTimeout> | undefined;
		try {
			let snapshot = await Promise.race([
				loading,
				new Promise<null>((resolve) => {
					timer = setTimeout(() => resolve(null), 150);
				}),
			]);
			clearTimeout(timer);
			if (
				waitForRefreshMs > 0 &&
				!SOURCES.some((source) => snapshot?.sources[source]?.results.length)
			) {
				const remaining = Math.max(
					0,
					waitForRefreshMs - (performance.now() - startedAt),
				);
				await Promise.race([
					background,
					new Promise<void>((resolve) => {
						timer = setTimeout(resolve, remaining);
					}),
				]);
				const latest = memory.get(key)?.snapshot;
				snapshot = hasResults(latest)
					? latest
					: hasResults(loadedSnapshot)
						? loadedSnapshot
						: (latest ?? loadedSnapshot ?? snapshot);
			}
			return SOURCES.flatMap(
				(source) => snapshot?.sources[source]?.results ?? [],
			);
		} finally {
			clearTimeout(timer);
		}
	};
}

export const getExtraReviews = createReviewCache();
