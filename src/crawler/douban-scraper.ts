/**
 * Douban scraper - fetch hot content via API
 */

export interface DoubanItem {
	title: string;
}

const GUDUO_ANIMATION_BILLBOARD =
	"https://d2.guduomedia.com/m/v3/billboard/list";
const DOUBAN_RECENT_HOT_MOVIE =
	"https://m.douban.com/rexxar/api/v2/subject/recent_hot/movie";
const DOUBAN_RECENT_HOT_TV =
	"https://m.douban.com/rexxar/api/v2/subject/recent_hot/tv";

const HEADERS = {
	"User-Agent":
		"Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
	Accept: "application/json",
};

interface RecentHotListResponse {
	items?: Array<{
		title: string;
	}>;
}

interface GuduoBillboardResponse {
	code?: number;
	data?: Array<{
		name: string;
	}>;
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

async function fetchDoubanRecentHot(options: {
	kind: "movie" | "tv";
	query: Record<string, string>;
}): Promise<DoubanItem[]> {
	const base =
		options.kind === "movie" ? DOUBAN_RECENT_HOT_MOVIE : DOUBAN_RECENT_HOT_TV;
	try {
		const params = new URLSearchParams({
			start: "0",
			limit: "20",
			...options.query,
		});
		const url = `${base}?${params.toString()}`;
		const response = await fetch(url, {
			headers: {
				...HEADERS,
				Referer: "https://m.douban.com/",
			},
		});

		if (!response.ok) {
			console.error(
				`Douban recent_hot/${options.kind} error: ${response.status}`,
			);
			return [];
		}

		const data = (await response.json()) as RecentHotListResponse;
		const items = data.items || [];

		return items.map((item) => ({
			title: item.title.split(" ")[0],
		}));
	} catch (error) {
		console.error(`Error fetching Douban recent_hot/${options.kind}:`, error);
		return [];
	}
}

/**
 * Hot movies: m.douban rexxar recent_hot (热门 + 华语).
 */
export async function fetchDoubanHotMovies(): Promise<DoubanItem[]> {
	return fetchDoubanRecentHot({
		kind: "movie",
		query: { category: "热门", type: "华语" },
	});
}

/**
 * Domestic TV dramas: m.douban rexxar recent_hot (国产剧 tab).
 */
export async function fetchDoubanHotTVSeries(): Promise<DoubanItem[]> {
	return fetchDoubanRecentHot({
		kind: "tv",
		query: { category: "tv", type: "tv_domestic" },
	});
}

/**
 * Hot animation: Guduo daily billboard (ALL_ANIME). Date steps back if latest day has no data yet.
 */
export async function fetchDoubanHotAnimation(): Promise<DoubanItem[]> {
	try {
		for (let daysBack = 0; daysBack < 14; daysBack++) {
			const date = shanghaiYYYYMMDDMinusDays(daysBack);
			const params = new URLSearchParams({
				type: "DAILY",
				category: "ALL_ANIME",
				date,
				attach: "gdi",
				orderTitle: "gdi",
				platformId: "0",
			});
			const url = `${GUDUO_ANIMATION_BILLBOARD}?${params.toString()}`;
			const response = await fetch(url, {
				headers: {
					...HEADERS,
					Referer: "https://d2.guduomedia.com/",
				},
			});

			if (!response.ok) {
				console.error(`Guduo billboard error: ${response.status}`);
				continue;
			}

			const data = (await response.json()) as GuduoBillboardResponse;
			if (data.code != null && data.code !== 0) {
				continue;
			}
			const rows = data.data || [];
			if (rows.length === 0) {
				continue;
			}

			return rows.slice(0, 20).map((row) => ({
				title: row.name.split(" ")[0],
			}));
		}
		return [];
	} catch (error) {
		console.error("Error fetching Guduo animation billboard:", error);
		return [];
	}
}

/**
 * Hot variety (国内综艺): m.douban rexxar recent_hot (category=show, type=show_domestic).
 */
export async function fetchDoubanHotVarietyShows(): Promise<DoubanItem[]> {
	return fetchDoubanRecentHot({
		kind: "tv",
		query: { category: "show", type: "show_domestic" },
	});
}
