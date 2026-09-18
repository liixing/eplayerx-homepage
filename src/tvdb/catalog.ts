import { artworkURL, tvdbGet, tvdbLanguage } from "./client.js";

type SeasonType = {
	id?: number;
	name?: string;
	type?: string;
};

type SeriesSeason = {
	id?: number;
	number?: number;
	name?: string;
	year?: string;
	type?: SeasonType;
};

type EpisodeRecord = {
	id?: number;
	name?: string | null;
	number?: number;
	seasonNumber?: number;
	aired?: string | null;
	runtime?: number | null;
	overview?: string | null;
	image?: string | null;
};

type SeriesExtended = {
	data?: {
		name?: string;
		defaultSeasonType?: number;
		seasons?: SeriesSeason[];
	};
};

type EpisodesPage = {
	data?: {
		episodes?: EpisodeRecord[];
	};
	links?: {
		next?: string | null;
	};
};

export type CatalogSeason = {
	number: number;
	name: string;
	episodeCount: number;
	airDate: string | null;
};

export type CatalogEpisode = {
	id: number;
	episodeNumber: number;
	seasonNumber: number;
	name: string;
	overview: string;
	airDate: string;
	runtime: number | null;
	stillPath: string | null;
};

export type SeriesCatalog = {
	seasons: CatalogSeason[];
	episodes: CatalogEpisode[];
};

const CATALOG_TTL_MS = 12 * 60 * 60 * 1000;

type CacheEntry = {
	value: SeriesCatalog;
	expiresAt: number;
};

const catalogCache = new Map<string, CacheEntry>();

function firstAired(episodes: EpisodeRecord[]): string | null {
	const dates = episodes
		.map((episode) => episode.aired?.trim())
		.filter((value): value is string => Boolean(value))
		.sort();
	return dates[0] ?? null;
}

function mergeEpisode(
	base: EpisodeRecord,
	translated?: EpisodeRecord,
): CatalogEpisode | null {
	const id = base.id;
	const episodeNumber = base.number;
	const seasonNumber = base.seasonNumber;
	if (id == null || episodeNumber == null || seasonNumber == null) {
		return null;
	}
	return {
		id,
		episodeNumber,
		seasonNumber,
		name: (translated?.name || base.name || "").trim(),
		overview: (translated?.overview || base.overview || "").trim(),
		airDate: (base.aired || translated?.aired || "").trim(),
		runtime: base.runtime ?? translated?.runtime ?? null,
		stillPath: artworkURL(base.image || translated?.image),
	};
}

async function fetchEpisodePages(
	pathForPage: (page: number) => string,
): Promise<EpisodeRecord[]> {
	const episodes: EpisodeRecord[] = [];
	for (let page = 0; page < 20; page += 1) {
		const json = await tvdbGet<EpisodesPage>(pathForPage(page));
		const batch = json.data?.episodes ?? [];
		episodes.push(...batch);
		if (!json.links?.next || batch.length === 0) break;
	}
	return episodes;
}

function officialSeasons(extended: SeriesExtended): SeriesSeason[] {
	const seasons = extended.data?.seasons ?? [];
	const official = seasons.filter((season) => season.type?.type === "official");
	return official.length > 0 ? official : seasons;
}

export async function loadSeriesCatalog(
	id: number,
	language: string,
): Promise<SeriesCatalog> {
	const lang = tvdbLanguage(language);
	const cacheKey = `${id}:${lang}`;
	const cached = catalogCache.get(cacheKey);
	if (cached && cached.expiresAt > Date.now()) {
		return cached.value;
	}

	const [extended, official] = await Promise.all([
		tvdbGet<SeriesExtended>(`/series/${id}/extended?short=true`),
		fetchEpisodePages(
			(page) => `/series/${id}/episodes/official?page=${page}`,
		),
	]);
	const translated =
		lang === "eng"
			? []
			: await fetchEpisodePages(
					(page) => `/series/${id}/episodes/official/${lang}?page=${page}`,
				);

	const translatedById = new Map<number, EpisodeRecord>();
	for (const episode of translated) {
		if (episode.id != null) translatedById.set(episode.id, episode);
	}

	const episodes = official
		.map((episode) =>
			mergeEpisode(
				episode,
				episode.id != null ? translatedById.get(episode.id) : undefined,
			),
		)
		.filter((episode): episode is CatalogEpisode => episode != null)
		.sort((a, b) =>
			a.seasonNumber === b.seasonNumber
				? a.episodeNumber - b.episodeNumber
				: a.seasonNumber - b.seasonNumber,
		);

	const bySeason = new Map<number, CatalogEpisode[]>();
	for (const episode of episodes) {
		const list = bySeason.get(episode.seasonNumber) ?? [];
		list.push(episode);
		bySeason.set(episode.seasonNumber, list);
	}

	const seasons: CatalogSeason[] = officialSeasons(extended)
		.map((season) => {
			const number = season.number;
			if (number == null || number < 0) return null;
			const seasonEpisodes = bySeason.get(number) ?? [];
			return {
				number,
				name: (season.name ?? "").trim(),
				episodeCount: seasonEpisodes.length,
				airDate: firstAired(
					official.filter((episode) => episode.seasonNumber === number),
				),
			} satisfies CatalogSeason;
		})
		.filter((season): season is CatalogSeason => season != null)
		.sort((a, b) => a.number - b.number);

	if (seasons.length === 0) {
		for (const [number, seasonEpisodes] of [...bySeason.entries()].sort(
			(a, b) => a[0] - b[0],
		)) {
			seasons.push({
				number,
				name: "",
				episodeCount: seasonEpisodes.length,
				airDate: seasonEpisodes[0]?.airDate || null,
			});
		}
	}

	const value = { seasons, episodes };
	catalogCache.set(cacheKey, {
		value,
		expiresAt: Date.now() + CATALOG_TTL_MS,
	});
	return value;
}
