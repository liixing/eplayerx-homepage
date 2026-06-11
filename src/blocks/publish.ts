/**
 * Local publishing pipeline for community blocks.
 *
 * Replaces the old in-worker auto-scrape on approval: the admin runs a small
 * script locally (see scripts/blocks/), which feeds ranked titles through
 * TMDB search + artwork enrichment, uploads the snapshot to R2, and prints
 * the public data URL + blockId to paste into the /admin review form.
 *
 * TMDB requests run with the *submitter's* token so traffic spreads across
 * tokens instead of hammering the admin's own. The token never lives in the
 * repo: scripts reference a submissionId, and the token is fetched at runtime
 * from the worker (GET /admin/api/token/:id, backed by D1).
 *
 * .env needs the R2 credentials plus BLOCKS_ADMIN_PASSWORD: it authenticates
 * both the token fetch and the publish report (POST /admin/api/report) that
 * registers blockId / itemCount / script path in D1.
 */

import path from "node:path";
import {
	fetchImageMeta,
	type SearchTmdbOptions,
	searchTMDB,
	type TmdbClient,
	type TmdbSearchResult,
} from "../crawler/tmdb-enrich.js";
import { createTmdbClient } from "../tmdb/client.js";
import { shortId } from "./runtime.js";
import { publicDataUrl, publicKey, putSnapshot } from "./storage.js";
import type { MediaType, SnapshotItem } from "./types.js";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const TMDB_REQUEST_DELAY_MS = 300;

export interface PublishItem {
	title: string;
	/** Extra search queries (e.g. other languages) tried when the title misses. */
	altTitles?: string[];
	/** Known TMDB id: skip title search and fetch details directly. */
	tmdbId?: number;
	/** Per-item media type override (e.g. a TV entry inside a movie list). */
	mediaType?: MediaType;
	/** Movie release year, used to disambiguate title search (e.g. remakes). */
	year?: number;
}

export interface PublishBlockOptions {
	/** Submission id (shown in /admin); its stored TMDB token is fetched at runtime. */
	submissionId?: string;
	/** Explicit TMDB token override (avoid committing tokens to the repo). */
	tmdbToken?: string;
	/** Reuse an existing id to overwrite its snapshot; omit to mint a new one. */
	blockId?: string;
	mediaType: MediaType;
	/** TMDB search language, default zh-CN. */
	language?: string;
	/** e.g. [TMDB_TV_GENRE_ANIMATION] to only match animation on TV search. */
	requireTvGenreIds?: number[];
	/** Store TMDB's localized title (per `language`) instead of the scraped one. */
	useTmdbTitle?: boolean;
	/** Per-submission scraper: returns titles in ranked order. */
	fetchItems: () => Promise<PublishItem[]>;
}

export interface PublishBlockResult {
	blockId: string;
	itemCount: number;
	url: string;
}

/** The script being executed, relative to the repo root (for the registry). */
function currentScriptPath(): string | null {
	const entry = process.argv[1];
	return entry ? path.relative(process.cwd(), entry) : null;
}

/** Authenticated request to the worker's /admin/api/* endpoints. */
async function adminApi(
	apiPath: string,
	init?: RequestInit,
): Promise<Response> {
	const password = process.env.BLOCKS_ADMIN_PASSWORD;
	if (!password) {
		throw new Error(
			"BLOCKS_ADMIN_PASSWORD is not set; required to call the admin API.",
		);
	}
	const base = process.env.API_BASE_URL || "https://api.eplayerx.com";
	return fetch(new URL(apiPath, base), {
		...init,
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${password}`,
			...init?.headers,
		},
	});
}

/** Fetch the submitter's TMDB token from D1 (kept out of the repo). */
async function fetchSubmitterToken(submissionId: string): Promise<string> {
	const res = await adminApi(`/admin/api/token/${submissionId}`);
	if (!res.ok) {
		throw new Error(`token fetch failed (HTTP ${res.status})`);
	}
	const { token } = (await res.json()) as { token?: string };
	if (!token) {
		throw new Error(`submission ${submissionId} has no stored TMDB token`);
	}
	return token;
}

async function resolveToken(options: PublishBlockOptions): Promise<string> {
	const explicit = options.tmdbToken?.trim();
	if (explicit) return explicit;
	if (options.submissionId) {
		return fetchSubmitterToken(options.submissionId.trim());
	}
	throw new Error("Provide submissionId (preferred) or tmdbToken.");
}

/** Current display title of an already-registered block (D1 truth). New
 *  blocks have no row yet; they get a title on the next republish. */
async function fetchBlockTitle(blockId: string): Promise<string | undefined> {
	const base = process.env.API_BASE_URL || "https://api.eplayerx.com";
	try {
		const res = await fetch(
			new URL(`/blocks/import-payload?blockId=${blockId}`, base),
		);
		if (!res.ok) return undefined;
		const { title } = (await res.json()) as { title?: string };
		return title || undefined;
	} catch {
		return undefined;
	}
}

/** Register the publish in D1 via the worker (admin console reads this). */
async function reportPublish(
	blockId: string,
	itemCount: number,
): Promise<void> {
	const res = await adminApi("/admin/api/report", {
		method: "POST",
		body: JSON.stringify({
			blockId,
			itemCount,
			scriptPath: currentScriptPath(),
		}),
	});
	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new Error(`report failed (HTTP ${res.status}): ${text}`);
	}
}

// Trailing season markers that break TMDB search, e.g. "第5期" / "Season2".
const SEASON_SUFFIX_PATTERNS = [
	/\s*第\s*[0-9０-９一二三四五六七八九十]+\s*(期|季|部分|部|シリーズ|シーズン)$/,
	/\s*(最终季|最終季|最终章|最終章)$/,
	/\s*season\s*[0-9０-９]+$/i,
	/\s*[0-9]+(st|nd|rd|th)\s*season$/i,
	/\s*part\.?\s*[0-9０-９]+$/i,
	/\s*REBOOT$/i,
];

/** "彼女、お借りします 第5期" -> "彼女、お借りします"; null when no suffix. */
function stripSeasonSuffix(title: string): string | null {
	for (const pattern of SEASON_SUFFIX_PATTERNS) {
		if (pattern.test(title)) return title.replace(pattern, "").trim();
	}
	return null;
}

/** Search queries in priority order: originals first, season-stripped last. */
function buildQueries(item: PublishItem): string[] {
	const queries = [item.title, ...(item.altTitles ?? [])];
	// Iterate the growing queue so stacked suffixes strip in turn,
	// e.g. "石纪元 第四季 Part 3" -> "石纪元 第四季" -> "石纪元".
	for (let i = 0; i < queries.length; i++) {
		const stripped = stripSeasonSuffix(queries[i]);
		if (stripped && !queries.includes(stripped)) queries.push(stripped);
	}
	return queries;
}

/** Details payload carries `genres` objects instead of search's `genre_ids`. */
interface TmdbDetails extends TmdbSearchResult {
	genres?: { id: number }[];
}

/** Fetch localized details directly when the source already knows the TMDB id. */
async function fetchDetailsById(
	tmdbId: number,
	mediaType: MediaType,
	language: string | undefined,
	client: TmdbClient,
): Promise<TmdbSearchResult | null> {
	try {
		const query = { language: language ?? "zh-CN" };
		const result =
			mediaType === "movie"
				? await client.GET(`/3/movie/${tmdbId}`, {
						params: { path: { movie_id: tmdbId }, query },
					})
				: await client.GET(`/3/tv/${tmdbId}`, {
						params: { path: { series_id: tmdbId }, query },
					});
		const data = result.data as TmdbDetails | undefined;
		if (!data?.id) return null;
		return { ...data, genre_ids: data.genres?.map((g) => g.id) ?? [] };
	} catch (error) {
		console.error(`TMDB details error for ${mediaType}/${tmdbId}:`, error);
		return null;
	}
}

function dedupeByTmdbId(items: SnapshotItem[]): SnapshotItem[] {
	const map = new Map<number, SnapshotItem>();
	for (const item of items) {
		if (!map.has(item.tmdbId)) map.set(item.tmdbId, item);
	}
	return Array.from(map.values());
}

async function resolveItem(
	item: PublishItem,
	mediaType: MediaType,
	searchOptions: SearchTmdbOptions,
	client: TmdbClient,
	useTmdbTitle: boolean,
): Promise<SnapshotItem | null> {
	let tmdbData: TmdbSearchResult | null = null;
	const itemMediaType = item.mediaType ?? mediaType;
	if (item.tmdbId) {
		tmdbData = await fetchDetailsById(
			item.tmdbId,
			itemMediaType,
			searchOptions.language,
			client,
		);
	}
	if (!tmdbData?.id) {
		const options = item.year
			? { ...searchOptions, year: item.year }
			: searchOptions;
		for (const query of buildQueries(item)) {
			tmdbData = await searchTMDB(query, itemMediaType, options, client);
			if (tmdbData?.id) break;
		}
	}
	// Source years can drift from TMDB (re-releases, remakes mislabeled):
	// retry once without the year filter before giving up.
	if (!tmdbData?.id && item.year) {
		for (const query of buildQueries(item)) {
			tmdbData = await searchTMDB(query, itemMediaType, searchOptions, client);
			if (tmdbData?.id) break;
		}
	}
	if (!tmdbData?.id) return null;

	const { thumb, logo, noLogoPoster } = await fetchImageMeta(
		tmdbData.id,
		itemMediaType,
		tmdbData.backdrop_path,
		tmdbData.poster_path,
		client,
	);

	const title = useTmdbTitle
		? tmdbData.name || tmdbData.title || item.title
		: item.title;

	return {
		title,
		tmdbId: tmdbData.id,
		vote_average: tmdbData.vote_average ?? null,
		poster_path: tmdbData.poster_path ?? null,
		backdrop_path: tmdbData.backdrop_path ?? null,
		genre_ids: tmdbData.genre_ids ?? [],
		media_type: itemMediaType,
		release_date: tmdbData.release_date ?? null,
		first_air_date: tmdbData.first_air_date ?? null,
		overview: tmdbData.overview ?? null,
		thumb,
		logo,
		noLogoPoster,
	};
}

/** Titles -> TMDB enrich -> R2 snapshot -> public URL. */
export async function publishBlock(
	options: PublishBlockOptions,
): Promise<PublishBlockResult> {
	const client = createTmdbClient(await resolveToken(options));

	const blockId = options.blockId || `community-${shortId()}`;
	const searchOptions: SearchTmdbOptions = {
		language: options.language,
		requireTvGenreIds: options.requireTvGenreIds,
	};

	const scraped = await options.fetchItems();
	console.log(`📥 ${scraped.length} titles for ${blockId}`);

	const resolved: SnapshotItem[] = [];
	for (const entry of scraped) {
		const item = await resolveItem(
			entry,
			entry.mediaType ?? options.mediaType,
			searchOptions,
			client,
			options.useTmdbTitle ?? false,
		);
		if (item) {
			resolved.push(item);
			console.log(`✅ ${entry.title} -> ${item.tmdbId} (${item.title})`);
		} else {
			console.log(`❌ Not found: ${entry.title}`);
		}
		await delay(TMDB_REQUEST_DELAY_MS);
	}

	const items = dedupeByTmdbId(resolved);
	if (items.length === 0) {
		throw new Error("No items resolved on TMDB; nothing uploaded.");
	}

	// The block's display title rides on the snapshot: installed clients pick
	// up renames on their normal data refresh, and /blocks/data stays a pure
	// R2 passthrough (no D1 lookup per request).
	const title = await fetchBlockTitle(blockId);
	await putSnapshot(publicKey(blockId), items, title);
	const url = publicDataUrl(blockId);
	await reportPublish(blockId, items.length);

	console.log(`\n💾 Uploaded ${items.length} items (registered in D1)`);
	console.log(`🔗 ${url}`);
	console.log(`🆔 blockId: ${blockId} (paste into the /admin review form)`);

	return { blockId, itemCount: items.length, url };
}
