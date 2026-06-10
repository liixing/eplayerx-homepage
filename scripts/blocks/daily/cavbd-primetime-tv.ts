/**
 * CVB (中国视听大数据) primetime TV drama daily ratings, from the JSON API
 * behind the submitted www.cavbd.cn/information.html page.
 * Submission: 中国视听大数据 黄金时段电视剧收视情况 (zh-CN, thumb-list, rank) by @陈总.
 *
 * Fetches the latest available date's top-10 list. The same drama can air on
 * multiple channels (different rows); publishBlock dedupes by TMDB id, keeping
 * the higher-rated row's rank order.
 *
 * Run: bun run scripts/blocks/daily/cavbd-primetime-tv.ts
 */

import {
	type PublishItem,
	publishBlock,
} from "../../../src/blocks/publish.js";

const API_BASE = "https://www.cavbd.cn/prod-api/cvb/dayrankings";

interface DateListResponse {
	rows?: string[];
}

interface RankingRow {
	name?: string;
	sort?: number;
}

interface RankingListResponse {
	rows?: RankingRow[];
}

async function fetchJson<T>(url: string): Promise<T> {
	const res = await fetch(url, { headers: { Accept: "application/json" } });
	if (!res.ok) {
		throw new Error(`CVB API error: ${res.status} (${url})`);
	}
	return (await res.json()) as T;
}

async function fetchItems(): Promise<PublishItem[]> {
	const dates = await fetchJson<DateListResponse>(`${API_BASE}/datelist`);
	const latest = dates.rows?.[0];
	if (!latest) {
		throw new Error("CVB datelist returned no dates");
	}
	console.log(`📅 CVB primetime ratings for ${latest}`);

	const list = await fetchJson<RankingListResponse>(
		`${API_BASE}/list?date=${latest}&pageNum=1&pageSize=50`,
	);
	return (list.rows ?? [])
		.filter((row) => !!row.name)
		.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
		.map((row) => ({ title: row.name as string }));
}

await publishBlock({
	submissionId: "d2d9e1ce5eb3",
	blockId: "community-cavbd-primetime-tv",
	mediaType: "tv",
	language: "zh-CN",
	fetchItems,
});
