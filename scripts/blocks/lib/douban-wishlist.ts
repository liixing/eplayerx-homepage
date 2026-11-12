import type { PublishItem } from "../../../src/blocks/publish.js";
import { fetchWithRetry } from "./http.js";

interface WishlistRow extends PublishItem {
	doubanId: string;
}

const PAGE_SIZE = 15;
const HEADERS = {
	"User-Agent":
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
	Referer: "https://movie.douban.com/",
};

function decodeEntities(text: string): string {
	return text
		.replace(/&#x([0-9a-f]+);/gi, (_, n) =>
			String.fromCodePoint(Number.parseInt(n, 16)),
		)
		.replace(/&#(\d+);/g, (_, n) =>
			String.fromCodePoint(Number.parseInt(n, 10)),
		)
		.replace(/&quot;/g, '"')
		.replace(/&apos;|&#39;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&");
}

async function fetchWishlistRows(
	userId: string,
	type: "all" | "tv",
): Promise<WishlistRow[]> {
	const rows: WishlistRow[] = [];
	let total = 1;
	for (let start = 0; start < total; start += PAGE_SIZE) {
		const params = new URLSearchParams({
			start: String(start),
			sort: "time",
			type,
			filter: "all",
			mode: "grid",
		});
		const res = await fetchWithRetry(
			`https://movie.douban.com/people/${userId}/wish?${params}`,
			{ headers: HEADERS },
		);
		if (!res.ok) throw new Error(`Douban wishlist HTTP ${res.status}`);
		const html = await res.text();
		const count = html.match(/class="subject-num"[^>]*>([\s\S]*?)<\/span>/);
		const parsedTotal = decodeEntities(count?.[1] ?? "").match(/\/\s*(\d+)/);
		if (!parsedTotal) {
			throw new Error("Douban wishlist is unavailable or requires login.");
		}
		const pageTotal = Number(parsedTotal[1]);
		if (start > 0 && total !== pageTotal) {
			throw new Error("Douban wishlist changed during pagination. Retry.");
		}
		total = pageTotal;
		const page: WishlistRow[] = [];
		for (const match of html.matchAll(
			/<div class="item comment-item"[^>]*>([\s\S]*?)(?=<div class="item comment-item"|<div class="paginator"|$)/g,
		)) {
			const card = match[1];
			const doubanId = card.match(/\/subject\/(\d+)\//)?.[1];
			const display = card.match(/<em>([\s\S]*?)<\/em>/)?.[1];
			if (!doubanId || !display) throw new Error("Invalid wishlist entry.");
			const [title, ...altTitles] = decodeEntities(display)
				.trim()
				.split(/\s+\/\s+/);
			const intro = card.match(/class="intro">([^<]*)/);
			const year = intro?.[1].match(/\b((?:18|19|20)\d{2})\b/);
			page.push({
				doubanId,
				title,
				altTitles,
				...(year ? { year: Number(year[1]) } : {}),
			});
		}
		if (
			page.length > Math.min(PAGE_SIZE, total - start) ||
			(page.length === 0 && total > start)
		) {
			throw new Error("Douban wishlist returned an incomplete page.");
		}
		rows.push(...page);
		if (start + PAGE_SIZE < total) {
			await new Promise((resolve) => setTimeout(resolve, 500));
		}
	}
	if (new Set(rows.map((row) => row.doubanId)).size !== rows.length) {
		throw new Error("Douban wishlist repeated entries during pagination.");
	}
	return rows;
}

/** Public desktop pages expose the wishlist and its movie/TV filters. */
export async function fetchDoubanWishlistItems(
	userId: string,
): Promise<PublishItem[]> {
	if (!/^\d+$/.test(userId)) throw new Error("Invalid Douban user id.");
	const all = await fetchWishlistRows(userId, "all");
	const tv = await fetchWishlistRows(userId, "tv");
	const allIds = new Set(all.map((row) => row.doubanId));
	if (tv.some((row) => !allIds.has(row.doubanId))) {
		throw new Error(
			"Douban wishlist filters changed during pagination. Retry.",
		);
	}
	const tvIds = new Set(tv.map((row) => row.doubanId));
	return all.map(({ doubanId, ...row }) => ({
		...row,
		mediaType: tvIds.has(doubanId) ? "tv" : "movie",
	}));
}
