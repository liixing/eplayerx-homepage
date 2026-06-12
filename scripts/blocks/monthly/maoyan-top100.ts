/**
 * Maoyan all-time movie TOP100 (maoyan.com/board/4, 10 per page). The first
 * request only plants WAF cookies and 302s back to the same URL, so every
 * page is fetched with a shared cookie jar.
 * Submission: 猫眼电影TOP100榜 (zh-CN, movie, poster-list) by @冬天等雨.
 *
 * Run: bun run scripts/blocks/monthly/maoyan-top100.ts
 */

import { type PublishItem, publishBlock } from "../../../src/blocks/publish.js";

const BOARD_URL = "https://www.maoyan.com/board/4";
const PAGES = 10; // 10 per page -> TOP100

const USER_AGENT =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Pinned classics whose Maoyan year is the China re-release date, which
 * otherwise year-matches an unrelated film. */
const KNOWN_IDS: Record<string, number> = {
	美丽人生: 637,
	天堂电影院: 11216,
	一一: 25538,
	入殓师: 16804,
};

/** GET with the WAF cookie dance: collect Set-Cookie, retry on 302-to-self. */
async function fetchBoardPage(
	url: string,
	cookies: Map<string, string>,
): Promise<string> {
	for (let attempt = 0; attempt < 3; attempt++) {
		const res = await fetch(url, {
			redirect: "manual",
			headers: {
				"User-Agent": USER_AGENT,
				Cookie: Array.from(cookies, ([k, v]) => `${k}=${v}`).join("; "),
			},
		});
		for (const value of res.headers.getSetCookie()) {
			const [pair] = value.split(";");
			const eq = pair.indexOf("=");
			if (eq > 0) cookies.set(pair.slice(0, eq), pair.slice(eq + 1));
		}
		if (res.status === 200) return res.text();
		if (res.status !== 302) {
			throw new Error(`Maoyan page error: ${res.status}`);
		}
		await delay(300);
	}
	throw new Error("Maoyan kept redirecting; WAF cookie dance failed.");
}

async function fetchMaoyanTop100(): Promise<PublishItem[]> {
	const cookies = new Map<string, string>();
	const items: PublishItem[] = [];
	for (let page = 0; page < PAGES; page++) {
		const html = await fetchBoardPage(
			`${BOARD_URL}?offset=${page * 10}`,
			cookies,
		);
		const rows = html.matchAll(
			/class="name"><a[^>]*title="([^"]+)"[\s\S]*?class="releasetime">上映时间：(\d{4})/g,
		);
		for (const [, title, year] of rows) {
			items.push({ title, tmdbId: KNOWN_IDS[title], year: Number(year) });
		}
		await delay(500);
	}
	return items;
}

await publishBlock({
	submissionId: "499af669cbf6",
	blockId: "community-maoyan-top100",
	mediaType: "movie",
	language: "zh-CN",
	fetchItems: fetchMaoyanTop100,
});
