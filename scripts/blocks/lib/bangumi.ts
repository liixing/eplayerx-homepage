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

/** Today's airing anime (Asia/Shanghai), in Bangumi calendar order. */
export async function fetchBangumiTodayCalendar(
	knownIds: KnownIds = {},
): Promise<PublishItem[]> {
	const res = await fetch(`${API_BASE}/calendar`, { headers: HEADERS });
	if (!res.ok) {
		throw new Error(`Bangumi calendar error: ${res.status}`);
	}
	const days = (await res.json()) as CalendarDay[];
	// Bangumi weekday ids: Mon=1 ... Sun=7.
	const now = new Date(
		new Date().toLocaleString("en-US", { timeZone: "Asia/Shanghai" }),
	);
	const weekdayId = now.getDay() === 0 ? 7 : now.getDay();
	const today = days.find((d) => d.weekday?.id === weekdayId);
	if (!today?.items?.length) {
		throw new Error(`Bangumi calendar has no items for weekday ${weekdayId}`);
	}
	return today.items
		.map((subject) => toPublishItem(subject, knownIds))
		.filter((item): item is PublishItem => item !== null);
}
