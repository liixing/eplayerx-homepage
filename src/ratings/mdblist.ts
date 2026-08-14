import type { ItemRatings } from "./types.js";

const MDBLIST_BASE = "https://api.mdblist.com";
const REQUEST_TIMEOUT_MS = 20_000;

export class MdblistRateLimitError extends Error {
	constructor() {
		super("MDBList daily limit reached");
		this.name = "MdblistRateLimitError";
	}
}

export interface MdblistRating {
	source?: string;
	value?: number | null;
	score?: number | null;
	votes?: number | null;
	url?: string | number | null;
}

export interface MdblistPayload {
	title?: string;
	year?: number;
	type?: string;
	score?: number;
	scoreaverage?: number;
	score_average?: number;
	ids?: Record<string, unknown>;
	ratings?: MdblistRating[];
	error?: unknown;
}

export function mdblistMedia(type: "movie" | "tv"): "movie" | "show" {
	return type === "tv" ? "show" : "movie";
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function pickNumber(value: unknown): number | undefined {
	return isFiniteNumber(value) ? value : undefined;
}

/** Map MDBList `ratings[]` into the compact item payload. */
export function itemRatingsFromPayload(data: MdblistPayload): ItemRatings {
	const out: ItemRatings = {};
	const average =
		pickNumber(data.score_average) ?? pickNumber(data.scoreaverage);
	if (average !== undefined) out.average = average;

	for (const row of data.ratings ?? []) {
		const value = pickNumber(row.value);
		if (value === undefined || !row.source) continue;
		switch (row.source) {
			case "imdb":
				out.imdb = value;
				break;
			case "tomatoes":
				out.tomatoes = value;
				break;
			case "popcorn":
			case "tomatoesaudience":
				out.tomatoesAudience = value;
				break;
			case "metacritic":
				out.metacritic = value;
				break;
			case "trakt":
				out.trakt = value;
				break;
			case "letterboxd":
				out.letterboxd = value;
				break;
			case "tmdb":
				out.tmdb = value;
				break;
			case "mal":
				out.mal = value;
				break;
			default:
				break;
		}
	}
	return out;
}

async function fetchMdblist(url: string): Promise<Response> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	try {
		return await fetch(url, {
			headers: { accept: "application/json" },
			signal: controller.signal,
		});
	} finally {
		clearTimeout(timeout);
	}
}

export interface FetchMdblistOptions {
	tmdbId?: number;
	imdbId?: string;
	mediaType: "movie" | "tv";
	apiKey?: string;
}

export async function fetchMdblistPayload(
	options: FetchMdblistOptions,
): Promise<{ data: MdblistPayload; upstream: Response }> {
	const apiKey = options.apiKey ?? process.env.MDBLIST_API_KEY;
	if (!apiKey) {
		throw new Error("MDBLIST_API_KEY is not set");
	}
	if (!options.tmdbId && !options.imdbId) {
		throw new Error("tmdbId or imdbId is required");
	}

	const media = mdblistMedia(options.mediaType);
	const path = options.tmdbId
		? `/tmdb/${media}/${options.tmdbId}`
		: `/imdb/${media}/${options.imdbId}`;
	const url = new URL(path, MDBLIST_BASE);
	url.searchParams.set("apikey", apiKey);

	const upstream = await fetchMdblist(url.toString());
	if (upstream.status === 429) {
		throw new MdblistRateLimitError();
	}

	const data = (await upstream
		.json()
		.catch(() => null)) as MdblistPayload | null;
	if (upstream.status === 404) {
		throw Object.assign(new Error("Not found"), { status: 404 });
	}
	if (!upstream.ok) {
		throw Object.assign(new Error("MDBList request failed"), {
			status: upstream.status,
			body: data,
		});
	}
	if (!data || typeof data !== "object" || Array.isArray(data)) {
		throw new Error("Invalid MDBList response");
	}
	if (data.error) {
		throw Object.assign(new Error(String(data.error)), { status: 404 });
	}
	return { data, upstream };
}

/** Fetch compact ratings for one title. Empty object means found but no scores. */
export async function fetchItemRatings(
	tmdbId: number,
	mediaType: "movie" | "tv",
): Promise<ItemRatings> {
	const { data } = await fetchMdblistPayload({ tmdbId, mediaType });
	return itemRatingsFromPayload(data);
}
