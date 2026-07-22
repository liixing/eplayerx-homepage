/**
 * Main crawler: Douban -> TMDB -> JSON file
 */

import { fetchBangumiHotAnime } from "./bangumi-scraper.js";
import {
	fetchDoubanHotAnimation,
	fetchDoubanHotMovies,
	fetchDoubanHotTVSeries,
	fetchDoubanHotVarietyShows,
	fetchDoubanJapaneseTVSeries,
	fetchDoubanKoreanTVSeries,
} from "./douban-scraper.js";
import { fetchHamiTaiwaneseTVSeries } from "./hami-scraper.js";
import {
	type ContentItem,
	type ContentItemTranslation,
	saveBangumiAnimation,
	saveDoubanAnimation,
	saveHamiTaiwaneseTVSeries,
	saveHotVarietyShows,
	saveJapaneseTVSeries,
	saveKoreanTVSeries,
	saveMovies,
	saveTVSeries,
} from "./service.js";
import {
	fetchDetailsWithEnrichment,
	searchTMDB,
	TMDB_TV_GENRE_ANIMATION,
	type TmdbSearchResult,
} from "./tmdb-enrich.js";

const EXTRA_ENRICH_LANGUAGES = ["en-US", "ar-SA"] as const;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface CrawlTVSeriesOptions {
	label: string;
	fetchItems: () => Promise<Array<{ title: string }>>;
	saveItems: (items: ContentItem[]) => Promise<unknown>;
}

/** Align stored title + TMDB query when source uses alternate naming (e.g. 年番 suffix). */
function resolveAnimationTitle(title: string): string {
	if (title === "凡人修仙传年番") {
		return "凡人修仙传";
	}
	return title;
}

/**
 * Deduplicate content items by tmdbId, keeping the latest one
 */
function deduplicateByTmdbId(items: ContentItem[]): ContentItem[] {
	const map = new Map<number, ContentItem>();

	for (const item of items) {
		const existing = map.get(item.tmdbId);
		if (!existing || item.crawledAt > existing.crawledAt) {
			map.set(item.tmdbId, item);
		}
	}

	return Array.from(map.values());
}

function translationFromEnrichment(
	enriched: NonNullable<Awaited<ReturnType<typeof fetchDetailsWithEnrichment>>>,
): ContentItemTranslation {
	const data = enriched.tmdbData;
	const title = data.title || data.name || "";
	return {
		title,
		overview: data.overview ?? null,
		thumb: enriched.imageMeta.thumb,
		logo: enriched.imageMeta.logo,
		noLogoPoster: enriched.imageMeta.noLogoPoster,
		poster_path: data.poster_path ?? null,
		backdrop_path: data.backdrop_path ?? null,
	};
}

async function buildContentItem(
	title: string,
	tmdbData: TmdbSearchResult,
	mediaType: "movie" | "tv",
): Promise<ContentItem | null> {
	const tmdbId = tmdbData.id;
	if (!tmdbId) return null;

	const enriched = await fetchDetailsWithEnrichment(tmdbId, mediaType, "zh-CN");
	const data = enriched?.tmdbData ?? tmdbData;
	const externalIds = enriched?.externalIds ?? { imdbId: null, tvdbId: null };
	const imageMeta = enriched?.imageMeta ?? {
		thumb: data.backdrop_path || data.poster_path || null,
		logo: null,
		noLogoPoster: data.poster_path ?? null,
	};

	const translations: NonNullable<ContentItem["translations"]> = {};
	for (const language of EXTRA_ENRICH_LANGUAGES) {
		const localeKey = language.startsWith("ar") ? "ar" : "en";
		try {
			const localized = await fetchDetailsWithEnrichment(
				tmdbId,
				mediaType,
				language,
			);
			if (!localized) continue;
			const translation = translationFromEnrichment(localized);
			if (!translation.title) continue;
			translations[localeKey] = translation;
		} catch (error) {
			console.error(
				`Failed to enrich ${mediaType}/${tmdbId} for ${language}:`,
				error,
			);
		}
		await delay(150);
	}

	return {
		title,
		tmdbId,
		imdbId: externalIds.imdbId,
		tvdbId: externalIds.tvdbId,
		vote_average: data.vote_average ?? null,
		poster_path: data.poster_path,
		backdrop_path: data.backdrop_path,
		genre_ids: data.genre_ids || [],
		media_type: mediaType,
		release_date: data.release_date || null,
		first_air_date: data.first_air_date,
		overview: data.overview,
		thumb: imageMeta.thumb,
		logo: imageMeta.logo,
		noLogoPoster: imageMeta.noLogoPoster,
		...(Object.keys(translations).length > 0 ? { translations } : {}),
		crawledAt: new Date().toISOString(),
	};
}

async function crawlDoubanTVSeriesCollection(options: CrawlTVSeriesOptions) {
	console.log(`📺 Crawling ${options.label}...`);

	const items = await options.fetchItems();
	console.log(`📥 Found ${items.length} ${options.label}`);

	const results: ContentItem[] = [];

	for (const item of items) {
		console.log(`🔍 Searching: ${item.title}`);

		const tmdbData = await searchTMDB(item.title, "tv");

		if (tmdbData) {
			const content = await buildContentItem(item.title, tmdbData, "tv");
			if (content) {
				results.push(content);
				console.log(`✅ ${content.tmdbId}`);
			}
		} else {
			console.log(`❌ Not found`);
		}

		await delay(300);
	}

	if (results.length > 0) {
		const deduplicated = deduplicateByTmdbId(results);
		await options.saveItems(deduplicated);
		console.log(
			`💾 Saved ${deduplicated.length} ${options.label} to JSON (${
				results.length - deduplicated.length
			} duplicates removed)\n`,
		);
	}

	return results;
}

/**
 * Crawl Douban movies
 */
export async function crawlDoubanMovies() {
	console.log("🎬 Crawling Douban movies...");

	const items = await fetchDoubanHotMovies();
	console.log(`📥 Found ${items.length} movies`);

	const results: ContentItem[] = [];

	for (const item of items) {
		console.log(`🔍 Searching: ${item.title}`);

		const tmdbData = await searchTMDB(item.title, "movie");

		if (tmdbData) {
			const content = await buildContentItem(item.title, tmdbData, "movie");
			if (content) {
				results.push(content);
				console.log(`✅ ${content.tmdbId}`);
			}
		} else {
			console.log(`❌ Not found`);
		}

		await delay(300);
	}

	if (results.length > 0) {
		const deduplicated = deduplicateByTmdbId(results);
		await saveMovies(deduplicated);
		console.log(
			`💾 Saved ${deduplicated.length} movies to JSON (${
				results.length - deduplicated.length
			} duplicates removed)\n`,
		);
	}

	return results;
}

/**
 * Crawl Douban TV series
 */
export async function crawlDoubanTVSeries() {
	return crawlDoubanTVSeriesCollection({
		label: "Douban domestic TV series",
		fetchItems: fetchDoubanHotTVSeries,
		saveItems: saveTVSeries,
	});
}

export async function crawlDoubanKoreanTVSeries() {
	return crawlDoubanTVSeriesCollection({
		label: "Douban Korean TV series",
		fetchItems: fetchDoubanKoreanTVSeries,
		saveItems: saveKoreanTVSeries,
	});
}

export async function crawlDoubanJapaneseTVSeries() {
	return crawlDoubanTVSeriesCollection({
		label: "Douban Japanese TV series",
		fetchItems: fetchDoubanJapaneseTVSeries,
		saveItems: saveJapaneseTVSeries,
	});
}

export async function crawlHamiTaiwaneseTVSeries() {
	return crawlDoubanTVSeriesCollection({
		label: "Hami Taiwanese TV series",
		fetchItems: fetchHamiTaiwaneseTVSeries,
		saveItems: saveHamiTaiwaneseTVSeries,
	});
}

/**
 * Crawl Douban animation
 */
export async function crawlDoubanAnimation() {
	console.log("🎨 Crawling Douban animation...");

	const items = await fetchDoubanHotAnimation();
	console.log(`📥 Found ${items.length} animation`);

	const results: ContentItem[] = [];

	for (const item of items) {
		const title = resolveAnimationTitle(item.title);
		console.log(`🔍 Searching: ${title}`);

		const tmdbData = await searchTMDB(title, "tv", {
			requireTvGenreIds: [TMDB_TV_GENRE_ANIMATION],
		});

		if (tmdbData) {
			const content = await buildContentItem(title, tmdbData, "tv");
			if (content) {
				results.push(content);
				console.log(`✅ ${content.tmdbId}`);
			}
		} else {
			console.log(`❌ Not found (Animation genre)`);
		}

		await delay(300);
	}

	if (results.length > 0) {
		const deduplicated = deduplicateByTmdbId(results);
		await saveDoubanAnimation(deduplicated);
		console.log(
			`💾 Saved ${deduplicated.length} animation to JSON (${
				results.length - deduplicated.length
			} duplicates removed)\n`,
		);
	}

	return results;
}

/**
 * Crawl Douban hot variety shows
 */
export async function crawlDoubanHotVarietyShows() {
	console.log("🔥 Crawling Douban hot variety shows...");

	const items = await fetchDoubanHotVarietyShows();
	console.log(`📥 Found ${items.length} hot variety shows`);

	const results: ContentItem[] = [];

	for (const item of items) {
		console.log(`🔍 Searching: ${item.title}`);

		const tmdbData = await searchTMDB(item.title, "tv");

		if (tmdbData) {
			const content = await buildContentItem(item.title, tmdbData, "tv");
			if (content) {
				results.push(content);
				console.log(`✅ ${content.tmdbId}`);
			}
		} else {
			console.log(`❌ Not found`);
		}

		await delay(300);
	}

	if (results.length > 0) {
		const deduplicated = deduplicateByTmdbId(results);
		await saveHotVarietyShows(deduplicated);
		console.log(
			`💾 Saved ${deduplicated.length} hot variety shows to JSON (${
				results.length - deduplicated.length
			} duplicates removed)\n`,
		);
	}

	return results;
}

/**
 * Crawl Bangumi animation
 */
export async function crawlBangumiAnimation() {
	console.log("🎌 Crawling Bangumi animation...");

	const items = await fetchBangumiHotAnime();
	console.log(`📥 Found ${items.length} animation`);

	const results: ContentItem[] = [];

	for (const item of items) {
		const title = resolveAnimationTitle(item.title);
		console.log(`🔍 Searching: ${title}`);

		const tmdbData = await searchTMDB(title, "tv", {
			requireTvGenreIds: [TMDB_TV_GENRE_ANIMATION],
		});

		if (tmdbData) {
			const content = await buildContentItem(title, tmdbData, "tv");
			if (content) {
				results.push(content);
				console.log(`✅ ${content.tmdbId}`);
			}
		} else {
			console.log(`❌ Not found (Animation genre)`);
		}

		await delay(300);
	}

	if (results.length > 0) {
		const deduplicated = deduplicateByTmdbId(results);
		await saveBangumiAnimation(deduplicated);
		console.log(
			`💾 Saved ${deduplicated.length} animation to JSON (${
				results.length - deduplicated.length
			} duplicates removed)\n`,
		);
	}

	return results;
}

/**
 * Run all crawlers
 */
async function runAllCrawlers() {
	console.log("🚀 Starting crawlers...\n");

	await crawlDoubanMovies();
	await crawlDoubanTVSeries();
	await crawlDoubanKoreanTVSeries();
	await crawlDoubanJapaneseTVSeries();
	await crawlHamiTaiwaneseTVSeries();
	await crawlDoubanAnimation();
	await crawlDoubanHotVarietyShows();
	await crawlBangumiAnimation();

	console.log("✅ Done!");
}

// Run if executed directly
if (process.argv[1]?.includes("crawlers")) {
	runAllCrawlers().catch(console.error);
}
