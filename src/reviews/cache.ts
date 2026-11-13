import { getRawJson, putRawJson } from "../blocks/storage.js";
import { getTmdb } from "../tmdb/client.js";
import {
	type ExtraReview,
	fetchBahamutReviews,
	fetchDoubanReviews,
	type MediaType,
	type ReviewSource,
	type ReviewTitle,
	type SourceReviews,
} from "./providers.js";

interface SourceSnapshot extends SourceReviews {
	retryAt: number;
}
interface Snapshot {
	version: 1;
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

async function resolveTitle(type: MediaType, id: number): Promise<ReviewTitle> {
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
			};
		}),
	);
	const first = details[0];
	const year = Number(
		(first.release_date ?? first.first_air_date ?? "").slice(0, 4),
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
	return {
		type,
		titles,
		year,
		animated: first.genres?.some((genre) => genre.id === 16) ?? false,
	};
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
			const next: Snapshot = { version: 1, sources: { ...snapshot.sources } };
			try {
				const title = await dependencies.resolveTitle(type, id);
				await Promise.all(
					due.map(async (source) => {
						const previous = snapshot.sources[source];
						try {
							const result = await dependencies.fetchers[source](
								title,
								previous?.sourceId,
							);
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
	): Promise<ExtraReview[]> => {
		if (!storage) return [];
		const startedAt = performance.now();
		const key = `reviews/v1/${type}/${id}.json`;
		const loading = read(key, storage);
		const background = loading.then((snapshot) =>
			snapshot ? refresh(key, type, id, storage, snapshot) : undefined,
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
				snapshot = memory.get(key)?.snapshot ?? snapshot;
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
