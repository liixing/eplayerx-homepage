import { integer } from "./episode-timings.js";
import { tmdb } from "./tmdb/index.js";

export type AiringEpisode = {
	season: number;
	episode: number;
	airDate: string | null;
};

export type AdScanCatalog = {
	status: string | null;
	ongoing: boolean | null;
	lastAired: AiringEpisode | null;
	nextAiring: AiringEpisode | null;
	posterPath?: string;
	year?: string;
};

function airingEpisode(value: unknown): AiringEpisode | null {
	if (!value || typeof value !== "object") return null;
	const item = value as Record<string, unknown>;
	const season = integer(item.season_number, 0, 1000);
	const episode = integer(item.episode_number, 1, 100000);
	if (season === undefined || episode === undefined) return null;
	const date = typeof item.air_date === "string" ? item.air_date : "";
	const time = /^\d{4}-\d{2}-\d{2}$/.test(date)
		? Date.parse(`${date}T00:00:00Z`)
		: NaN;
	const airDate =
		Number.isFinite(time) && new Date(time).toISOString().startsWith(date)
			? date
			: null;
	return { season, episode, airDate };
}

export async function lookupAdScanSeries(id: number) {
	const result = await tmdb.GET(`/3/tv/${id}`, {
		params: { path: { series_id: id }, query: { language: "zh-CN" } },
		signal: AbortSignal.timeout(5000),
	});
	const series = result.data;
	if (!series?.name)
		return { found: false as const, missing: result.response.status === 404 };
	const status = series.status || null;
	const firstAirDate = series.first_air_date ?? "";
	const nextAiring = airingEpisode(series.next_episode_to_air);
	const ongoing =
		status === "Ended" || status === "Canceled"
			? false
			: status === "Returning Series" || series.in_production || nextAiring
				? true
				: null;
	const catalog: AdScanCatalog = {
		status,
		ongoing,
		lastAired: airingEpisode(series.last_episode_to_air),
		nextAiring,
		posterPath: /^\/[\w.-]+$/.test(series.poster_path ?? "")
			? series.poster_path
			: undefined,
		year: /^\d{4}-\d{2}-\d{2}$/.test(firstAirDate)
			? firstAirDate.slice(0, 4)
			: undefined,
	};
	return { found: true as const, title: series.name, catalog };
}

export function hasCoveredEpisode(
	season: number | null,
	episode: number | null,
	aired: AiringEpisode,
) {
	return (
		season !== null &&
		episode !== null &&
		(season > aired.season ||
			(season === aired.season && episode >= aired.episode))
	);
}
