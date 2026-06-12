/**
 * Generic data-source scraper for community blocks.
 *
 * Runs with the *submitter's* TMDB token. Fetches any declared source
 * (relative path against this API, or an absolute URL), normalizes the items,
 * and enriches the top rows with TMDB artwork — producing a `SnapshotItem[]`
 * that mirrors the crawler output the client already decodes.
 */

import type { MediaType, ScrapeOptions, SnapshotItem } from "./types.js";

const TMDB_BASE =
	process.env.PUBLIC_TMDB_API_BASE_URL || "https://api.themoviedb.org";

const MAX_PAGES = 5;
const ENRICH_TOP_N = 20;
const IMAGE_CONCURRENCY = 5;

export class ScrapeError extends Error {}

/** Validate a TMDB read-access token via a cheap authenticated endpoint. */
export async function validateToken(token: string): Promise<boolean> {
	try {
		const res = await fetch(new URL("/3/authentication", TMDB_BASE), {
			headers: { accept: "application/json", Authorization: `Bearer ${token}` },
		});
		return res.ok;
	} catch {
		return false;
	}
}

interface RawItem {
	id?: number;
	tmdbId?: number;
	title?: string;
	name?: string;
	vote_average?: number;
	poster_path?: string | null;
	backdrop_path?: string | null;
	genre_ids?: number[];
	release_date?: string | null;
	first_air_date?: string | null;
	overview?: string | null;
	thumb?: string | null;
	logo?: string | null;
	noLogoPoster?: string | null;
}

function joinUrl(base: string, path: string): string {
	if (/^https?:\/\//i.test(path)) return path;
	const b = base.endsWith("/") ? base.slice(0, -1) : base;
	return b + (path.startsWith("/") ? path : `/${path}`);
}

function buildUrl(
	apiBaseUrl: string,
	path: string,
	query?: ScrapeOptions["query"],
	pageParam?: string,
	page?: number,
): URL {
	const url = new URL(joinUrl(apiBaseUrl, path));
	for (const [key, value] of Object.entries(query ?? {})) {
		url.searchParams.set(key, String(value));
	}
	if (pageParam && page !== undefined) {
		url.searchParams.set(pageParam, String(page));
	}
	return url;
}

/** Auto-detect the list inside a payload: top-level array, then results/data, then first array value. */
function extractItems(payload: unknown): RawItem[] {
	if (Array.isArray(payload)) return payload as RawItem[];
	if (payload && typeof payload === "object") {
		const obj = payload as Record<string, unknown>;
		if (Array.isArray(obj.results)) return obj.results as RawItem[];
		if (Array.isArray(obj.data)) return obj.data as RawItem[];
		for (const value of Object.values(obj)) {
			if (Array.isArray(value)) return value as RawItem[];
		}
	}
	return [];
}

function normalize(raw: RawItem, mediaType: MediaType): SnapshotItem | null {
	const tmdbId = raw.tmdbId ?? raw.id;
	if (!tmdbId) return null;
	return {
		title: raw.title || raw.name || "",
		tmdbId,
		vote_average: raw.vote_average ?? null,
		poster_path: raw.poster_path ?? null,
		backdrop_path: raw.backdrop_path ?? null,
		genre_ids: raw.genre_ids ?? [],
		media_type: mediaType,
		release_date: raw.release_date ?? null,
		first_air_date: raw.first_air_date ?? null,
		overview: raw.overview ?? null,
		thumb: raw.thumb ?? raw.backdrop_path ?? raw.poster_path ?? null,
		logo: raw.logo ?? null,
		noLogoPoster: raw.noLogoPoster ?? null,
	};
}

async function fetchJson(url: URL, token: string): Promise<unknown> {
	const headers: Record<string, string> = { accept: "application/json" };
	// Only attach the token for absolute (likely TMDB) URLs; relative paths hit
	// this API which carries its own server token.
	if (/^https?:\/\//i.test(url.href) && url.origin.includes("themoviedb")) {
		headers.Authorization = `Bearer ${token}`;
	}
	const res = await fetch(url, { headers });
	if (res.status === 401) {
		throw new ScrapeError("数据源返回 401，token 无效或无权限。");
	}
	if (!res.ok) {
		throw new ScrapeError(`数据源请求失败（${res.status}）。`);
	}
	return res.json();
}

// MARK: - Artwork enrichment (logo / thumb / clean poster) for the top rows.

interface ImageEntry {
	iso_639_1?: string | null;
	iso_3166_1?: string;
	file_path?: string;
	vote_average?: number;
}

interface TmdbImagesResponse {
	backdrops?: ImageEntry[];
	logos?: ImageEntry[];
	posters?: ImageEntry[];
}

function bestByVote(entries: ImageEntry[]): ImageEntry | undefined {
	return entries.length
		? [...entries].sort(
				(a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0),
			)[0]
		: undefined;
}

async function enrichItem(
	token: string,
	item: SnapshotItem,
	languageCode: string,
): Promise<SnapshotItem> {
	try {
		const url = new URL(
			`/3/${item.media_type}/${item.tmdbId}/images`,
			TMDB_BASE,
		);
		const res = await fetch(url, {
			headers: { accept: "application/json", Authorization: `Bearer ${token}` },
		});
		if (!res.ok) return item;
		const images = (await res.json()) as TmdbImagesResponse;

		const backdrops = images.backdrops ?? [];
		const thumb =
			backdrops.find((b) => b.iso_639_1 === languageCode)?.file_path ||
			backdrops.find((b) => b.iso_639_1 === "en")?.file_path ||
			backdrops.find((b) => b.iso_639_1 === null)?.file_path ||
			backdrops[0]?.file_path ||
			item.backdrop_path ||
			item.poster_path ||
			null;

		const logos = images.logos ?? [];
		const logo =
			(
				bestByVote(logos.filter((l) => l.iso_639_1 === languageCode)) ??
				bestByVote(logos)
			)?.file_path ?? null;

		const posters = images.posters ?? [];
		// No textless poster available: fall back to the regular poster so
		// clients always have portrait art instead of a null slot.
		const noLogoPoster =
			bestByVote(posters.filter((p) => !p.iso_639_1))?.file_path ??
			item.poster_path ??
			null;

		return { ...item, thumb, logo, noLogoPoster };
	} catch {
		return item;
	}
}

async function enrichTop(
	token: string,
	items: SnapshotItem[],
	language: string,
): Promise<SnapshotItem[]> {
	const [languageCode] = language.split("-");
	const top = items.slice(0, ENRICH_TOP_N);
	const rest = items.slice(ENRICH_TOP_N);
	const enriched: SnapshotItem[] = [];
	for (let i = 0; i < top.length; i += IMAGE_CONCURRENCY) {
		const batch = top.slice(i, i + IMAGE_CONCURRENCY);
		const done = await Promise.all(
			batch.map((item) => enrichItem(token, item, languageCode)),
		);
		enriched.push(...done);
	}
	return [...enriched, ...rest];
}

function dedupe(items: SnapshotItem[]): SnapshotItem[] {
	const map = new Map<number, SnapshotItem>();
	for (const item of items) {
		if (!map.has(item.tmdbId)) map.set(item.tmdbId, item);
	}
	return Array.from(map.values());
}

function collectFromPayload(
	payload: unknown,
	mediaType: MediaType,
	into: SnapshotItem[],
): number {
	const items = extractItems(payload);
	for (const raw of items) {
		const item = normalize(raw, mediaType);
		if (item) into.push(item);
	}
	return items.length;
}

/**
 * Scrape into snapshot items. The submitter only provides `input` — either a
 * list URL/path, or pasted JSON data. Everything else (pagination, query,
 * language) is supplied by the admin at approval time via `opts`.
 */
export async function scrapeFromInput(
	token: string,
	input: string,
	apiBaseUrl: string,
	mediaType: MediaType,
	opts: ScrapeOptions = {},
): Promise<SnapshotItem[]> {
	const text = input.trim();
	const language = opts.language || "zh-CN";
	const collected: SnapshotItem[] = [];

	const looksLikeData = text.startsWith("{") || text.startsWith("[");
	if (looksLikeData) {
		let payload: unknown;
		try {
			payload = JSON.parse(text);
		} catch {
			throw new ScrapeError("粘贴的数据不是合法 JSON。");
		}
		collectFromPayload(payload, mediaType, collected);
	} else if (opts.pageParam) {
		const start = opts.startPage || 1;
		const pages = Math.min(Math.max(opts.pages || 1, 1), MAX_PAGES);
		for (let i = 0; i < pages; i += 1) {
			const url = buildUrl(
				apiBaseUrl,
				text,
				opts.query,
				opts.pageParam,
				start + i,
			);
			const count = collectFromPayload(
				await fetchJson(url, token),
				mediaType,
				collected,
			);
			if (!count) break;
		}
	} else {
		const url = buildUrl(apiBaseUrl, text, opts.query);
		collectFromPayload(await fetchJson(url, token), mediaType, collected);
	}

	const deduped = dedupe(collected);
	if (!deduped.length) {
		throw new ScrapeError("没有解析到任何条目，请检查榜单地址或粘贴的数据。");
	}
	return enrichTop(token, deduped, language);
}
