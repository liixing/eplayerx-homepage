/**
 * Parser for @陈总's Chinese-anime weekday schedule JSON on GitHub.
 * Source files are not strict JSON (trailing commas, empty slots, loose objects).
 */

import type { PublishItem } from "../../../src/blocks/publish.js";

export const GUOMAN_SOURCE_BASE =
	"https://raw.githubusercontent.com/chenluo666/EplayerX_Blocks/main";

export const GUOMAN_DAYS = [
	{ weekday: 1, file: "周一", blockId: "community-guoman-monday", label: "周一" },
	{ weekday: 2, file: "周二", blockId: "community-guoman-tuesday", label: "周二" },
	{ weekday: 3, file: "周三", blockId: "community-guoman-wednesday", label: "周三" },
	{ weekday: 4, file: "周四", blockId: "community-guoman-thursday", label: "周四" },
	{ weekday: 5, file: "周五", blockId: "community-guoman-friday", label: "周五" },
	{ weekday: 6, file: "周六", blockId: "community-guoman-saturday", label: "周六" },
	{ weekday: 7, file: "周日", blockId: "community-guoman-sunday", label: "周日" },
] as const;

/** Per-title overrides when the source id is wrong / points at a movie entry. */
const OVERRIDES: Record<string, PublishItem> = {
	择天记: { title: "择天记", tmdbId: 282158 },
	// Source used movie 1460127; the ongoing anime is TV 79481.
	斗破苍穹年番: { title: "斗破苍穹年番", tmdbId: 79481 },
};

const ENTRY_RE =
	/"title"\s*:\s*"([^"]*)"\s*,\s*"tmdb_id"\s*:\s*([^,}\n]+)/g;

function parseTmdbId(raw: string): number | null {
	const m = raw.trim().match(/^(\d+)/);
	if (!m) return null;
	const id = Number(m[1]);
	return Number.isFinite(id) && id > 0 ? id : null;
}

export async function fetchGuomanWeekday(file: string): Promise<PublishItem[]> {
	const url = `${GUOMAN_SOURCE_BASE}/${encodeURIComponent(file)}.json`;
	const res = await fetch(url, {
		headers: { "User-Agent": "eplayerx-blocks/1.0" },
	});
	if (!res.ok) throw new Error(`fetch ${file} failed: HTTP ${res.status}`);
	const text = await res.text();

	const items: PublishItem[] = [];
	const seen = new Set<number>();
	for (const match of text.matchAll(ENTRY_RE)) {
		const title = match[1].trim();
		if (!title) continue;

		const override = OVERRIDES[title];
		if (override) {
			if (override.tmdbId && seen.has(override.tmdbId)) continue;
			if (override.tmdbId) seen.add(override.tmdbId);
			items.push({ ...override });
			continue;
		}

		const tmdbId = parseTmdbId(match[2]);
		if (!tmdbId || seen.has(tmdbId)) continue;
		seen.add(tmdbId);
		items.push({ title, tmdbId });
	}
	return items;
}
