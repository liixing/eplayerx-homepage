/**
 * Guduo (骨朵) daily billboard API — same endpoint as src/crawler/douban-scraper.ts
 * animation fetcher, generalized for other categories.
 */

import type { PublishItem } from "../../../src/blocks/publish.js";

const BILLBOARD_URL = "https://d2.guduomedia.com/m/v3/billboard/list";
const HEADERS = {
	"User-Agent":
		"Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
	Accept: "application/json",
	Referer: "https://d2.guduomedia.com/",
};

interface GuduoBillboardResponse {
	code?: number;
	data?: Array<{ name?: string }>;
}

/** YYYY-MM-DD in Asia/Shanghai, minus calendar days. */
function shanghaiYYYYMMDDMinusDays(daysBack: number): string {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: "Asia/Shanghai",
		year: "numeric",
		month: "numeric",
		day: "numeric",
	}).formatToParts(new Date());
	const y = Number(parts.find((p) => p.type === "year")?.value);
	const mo = Number(parts.find((p) => p.type === "month")?.value);
	const da = Number(parts.find((p) => p.type === "day")?.value);
	const utc = Date.UTC(y, mo - 1, da - daysBack);
	return new Date(utc).toISOString().slice(0, 10);
}

/** Daily Guduo billboard rows for a category (steps back if latest day is empty). */
export async function fetchGuduoBillboardItems(
	category: string,
	max = 20,
): Promise<PublishItem[]> {
	for (let daysBack = 0; daysBack < 14; daysBack++) {
		const date = shanghaiYYYYMMDDMinusDays(daysBack);
		const params = new URLSearchParams({
			type: "DAILY",
			category,
			date,
			attach: "gdi",
			orderTitle: "gdi",
			platformId: "0",
		});
		const res = await fetch(`${BILLBOARD_URL}?${params.toString()}`, {
			headers: HEADERS,
		});
		if (!res.ok) continue;
		const data = (await res.json()) as GuduoBillboardResponse;
		if (data.code != null && data.code !== 0) continue;
		const rows = data.data ?? [];
		if (rows.length === 0) continue;
		return rows.slice(0, max).flatMap((row) => {
			const title = row.name?.split(" ")[0]?.trim();
			return title ? [{ title }] : [];
		});
	}
	throw new Error(`Guduo billboard empty for category ${category}`);
}
