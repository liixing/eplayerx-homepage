/**
 * Shared Bangumi (bgm.tv) fetchers built on the public v0 API.
 * Chinese names search TMDB directly; the Japanese original is the fallback.
 */

import type { PublishItem } from "../../../src/blocks/publish.js";

const API_BASE = "https://api.bgm.tv";

const HEADERS = {
	"User-Agent": "eplayerx-blocks/1.0 (https://eplayerx.com)",
	Accept: "application/json",
};

const PAGE_DELAY_MS = 500;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Series platforms; theatrical/OVA entries don't fit a tv block. */
const SERIES_PLATFORMS = new Set(["TV", "WEB"]);

interface BgmSubject {
	name?: string;
	name_cn?: string;
	platform?: string;
}

/** TMDB ids pinned per script where the Chinese/Japanese search fails. */
export type KnownIds = Record<string, number>;

function toPublishItem(
	subject: BgmSubject,
	knownIds: KnownIds,
): PublishItem | null {
	const primary = subject.name_cn || subject.name;
	if (!primary) return null;
	const alt =
		subject.name && subject.name !== primary ? [subject.name] : undefined;
	return {
		title: primary,
		...(alt ? { altTitles: alt } : {}),
		...(knownIds[primary] ? { tmdbId: knownIds[primary] } : {}),
	};
}

interface SubjectsResponse {
	data?: BgmSubject[];
}

/** Anime sorted by Bangumi rank, TV/WEB series only. */
export async function fetchBangumiRankedAnime(
	max = 100,
	knownIds: KnownIds = {},
): Promise<PublishItem[]> {
	const pageSize = 50;
	const items: PublishItem[] = [];
	for (let offset = 0; items.length < max; offset += pageSize) {
		const res = await fetch(
			`${API_BASE}/v0/subjects?type=2&sort=rank&limit=${pageSize}&offset=${offset}`,
			{ headers: HEADERS },
		);
		if (!res.ok) {
			throw new Error(`Bangumi subjects error: ${res.status}`);
		}
		const page = ((await res.json()) as SubjectsResponse).data ?? [];
		if (page.length === 0) break;
		for (const subject of page) {
			if (!SERIES_PLATFORMS.has(subject.platform ?? "")) continue;
			const item = toPublishItem(subject, knownIds);
			if (item) items.push(item);
			if (items.length >= max) break;
		}
		await delay(PAGE_DELAY_MS);
	}
	return items;
}

interface CalendarDay {
	weekday?: { id?: number };
	items?: BgmSubject[];
}

/** One run may publish all 7 weekdays; fetch the calendar only once. */
let calendarPromise: Promise<CalendarDay[]> | null = null;

function fetchCalendar(): Promise<CalendarDay[]> {
	calendarPromise ??= (async () => {
		const res = await fetch(`${API_BASE}/calendar`, { headers: HEADERS });
		if (!res.ok) {
			throw new Error(`Bangumi calendar error: ${res.status}`);
		}
		return (await res.json()) as CalendarDay[];
	})();
	return calendarPromise;
}

/** Airing anime for one weekday (Bangumi ids: Mon=1 ... Sun=7). */
export async function fetchBangumiCalendarDay(
	weekdayId: number,
	knownIds: KnownIds = {},
): Promise<PublishItem[]> {
	const days = await fetchCalendar();
	const day = days.find((d) => d.weekday?.id === weekdayId);
	if (!day?.items?.length) {
		throw new Error(`Bangumi calendar has no items for weekday ${weekdayId}`);
	}
	return day.items
		.map((subject) => toPublishItem(subject, knownIds))
		.filter((item): item is PublishItem => item !== null);
}

/** Today's airing anime (Asia/Shanghai), in Bangumi calendar order. */
export async function fetchBangumiTodayCalendar(
	knownIds: KnownIds = {},
): Promise<PublishItem[]> {
	const now = new Date(
		new Date().toLocaleString("en-US", { timeZone: "Asia/Shanghai" }),
	);
	const weekdayId = now.getDay() === 0 ? 7 : now.getDay();
	return fetchBangumiCalendarDay(weekdayId, knownIds);
}

const TAG_PAGE_UA =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36";

/** Anime tagged on Bangumi, sorted by rank (HTML list + v0 subject lookup). */
export async function fetchBangumiTaggedAnime(
	tag: string,
	max = 100,
	knownIds: KnownIds = {},
): Promise<PublishItem[]> {
	const items: PublishItem[] = [];
	const seen = new Set<string>();

	for (let page = 1; items.length < max; page++) {
		const url =
			page === 1
				? `https://bangumi.tv/anime/tag/${encodeURIComponent(tag)}/?sort=rank`
				: `https://bangumi.tv/anime/tag/${encodeURIComponent(tag)}/?sort=rank&page=${page}`;
		const res = await fetch(url, { headers: { "User-Agent": TAG_PAGE_UA } });
		if (!res.ok) {
			throw new Error(`Bangumi tag page error: ${res.status}`);
		}
		const html = await res.text();

		const pageIds: string[] = [];
		for (const match of html.matchAll(/\/subject\/(\d+)/g)) {
			const sid = match[1];
			if (!seen.has(sid)) {
				seen.add(sid);
				pageIds.push(sid);
			}
		}
		if (pageIds.length === 0) break;

		for (const sid of pageIds) {
			if (items.length >= max) break;
			const subjectRes = await fetch(`${API_BASE}/v0/subjects/${sid}`, {
				headers: HEADERS,
			});
			if (!subjectRes.ok) continue;
			const subject = (await subjectRes.json()) as BgmSubject;
			if (!SERIES_PLATFORMS.has(subject.platform ?? "")) continue;
			const item = toPublishItem(subject, knownIds);
			if (item) items.push(item);
			await delay(PAGE_DELAY_MS);
		}

		if (!html.includes(`page=${page + 1}`)) break;
		await delay(PAGE_DELAY_MS);
	}
	return items;
}
