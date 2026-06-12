/**
 * Shared Douban fetchers for community block scripts, built on the mobile
 * rexxar API (same endpoints as src/crawler/douban-scraper.ts).
 *
 * Item subtitles look like "2017 / 日本 美国 / 动作 惊悚 / ..." — the leading
 * year is passed along so TMDB search can disambiguate remakes.
 */

import type { PublishItem } from "../../../src/blocks/publish.js";

const REXXAR_BASE = "https://m.douban.com/rexxar/api/v2";
const PAGE_SIZE = 50;
const PAGE_DELAY_MS = 500;

const HEADERS = {
	"User-Agent":
		"Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
	Accept: "application/json",
	Referer: "https://m.douban.com/",
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface DoubanRowBase {
	title?: string;
	card_subtitle?: string;
	subtitle?: string;
	type?: string;
}

export function toPublishItem(row: DoubanRowBase): PublishItem | null {
	if (!row.title) return null;
	const subtitle = row.card_subtitle || row.subtitle || "";
	const year = Number.parseInt(subtitle.slice(0, 4), 10);
	return {
		title: row.title,
		// Mixed doulists carry both films and shows; the row type keeps each
		// item searching the right TMDB index regardless of block-level default.
		...(row.type === "tv" || row.type === "movie"
			? { mediaType: row.type }
			: {}),
		...(Number.isFinite(year) ? { year } : {}),
	};
}

async function fetchPaged<T>(
	buildUrl: (start: number) => string,
	pickRows: (data: unknown) => T[],
	getTotal: (data: unknown) => number,
	max: number,
): Promise<T[]> {
	const rows: T[] = [];
	for (let start = 0; start < max; start += PAGE_SIZE) {
		const res = await fetch(buildUrl(start), { headers: HEADERS });
		if (!res.ok) {
			throw new Error(`Douban API error: ${res.status}`);
		}
		const data = (await res.json()) as unknown;
		const page = pickRows(data);
		rows.push(...page);
		const total = getTotal(data);
		if (start + PAGE_SIZE >= Math.min(total, max) || page.length === 0) {
			break;
		}
		await delay(PAGE_DELAY_MS);
	}
	return rows;
}

interface CollectionResponse {
	total?: number;
	subject_collection_items?: DoubanRowBase[];
}

/** Items of a subject collection (e.g. movie_top250), in rank order. */
export async function fetchSubjectCollectionItems(
	collectionId: string,
	max = 300,
): Promise<PublishItem[]> {
	const rows = await fetchPaged(
		(start) =>
			`${REXXAR_BASE}/subject_collection/${collectionId}/items?start=${start}&count=${PAGE_SIZE}`,
		(d) => (d as CollectionResponse).subject_collection_items ?? [],
		(d) => (d as CollectionResponse).total ?? 0,
		max,
	);
	return rows
		.map(toPublishItem)
		.filter((item): item is PublishItem => item !== null);
}

interface DoulistResponse {
	total?: number;
	items?: DoubanRowBase[];
}

export interface DoulistOptions {
	max?: number;
	/** Douban row types to keep; movie-only by default (legacy film lists). */
	types?: ReadonlyArray<"movie" | "tv">;
}

/** Entries of a public doulist, in list order. */
export async function fetchDoulistItems(
	doulistId: string,
	options: DoulistOptions = {},
): Promise<PublishItem[]> {
	const { max = 300, types = ["movie"] } = options;
	const keep = new Set<string>(types);
	const rows = await fetchPaged(
		(start) =>
			`${REXXAR_BASE}/doulist/${doulistId}/items?start=${start}&count=${PAGE_SIZE}`,
		(d) => (d as DoulistResponse).items ?? [],
		(d) => (d as DoulistResponse).total ?? 0,
		max,
	);
	return rows
		.filter((row) => keep.has(row.type ?? ""))
		.map(toPublishItem)
		.filter((item): item is PublishItem => item !== null);
}
