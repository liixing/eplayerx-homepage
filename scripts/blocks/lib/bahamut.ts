/**
 * Shared scraper for Bahamut seasonal new-anime lists
 * (acg.gamer.com.tw/quarterly.php?d=N, where N is the weekday tab).
 *
 * Each entry's cover <img alt> carries "zh-TW,ja,en" names; the Japanese
 * original goes first as the primary TMDB query (most reliable), with
 * Traditional Chinese and English as fallbacks.
 */

import type { PublishItem } from "../../../src/blocks/publish.js";

const HEADERS = {
	"User-Agent":
		"Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
	Accept: "text/html",
};

export async function fetchBahamutQuarterly(
	day: number,
): Promise<PublishItem[]> {
	const res = await fetch(`https://acg.gamer.com.tw/quarterly.php?d=${day}`, {
		headers: HEADERS,
	});
	if (!res.ok) {
		throw new Error(`Bahamut page error: ${res.status}`);
	}
	const html = await res.text();

	// Cover block: <div class="ACG-mainbox2B">...<img alt="繁中,日文,English">.
	// The English part may itself contain commas, so only split twice.
	const items: PublishItem[] = [];
	const seen = new Set<string>();
	const re = /class="ACG-mainbox2B"[\s\S]*?alt="([^"]+)"/g;
	for (const match of html.matchAll(re)) {
		const [zhTw = "", ja = "", ...rest] = match[1].split(",");
		const en = rest.join(",").trim();
		if (!zhTw.trim() || seen.has(zhTw)) continue;
		seen.add(zhTw);
		const candidates = [ja.trim(), zhTw.trim(), en].filter(Boolean);
		items.push({ title: candidates[0], altTitles: candidates.slice(1) });
	}
	return items;
}
