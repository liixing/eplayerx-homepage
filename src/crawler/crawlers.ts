/**
 * Main crawler: Douban -> TMDB -> JSON file
 */

import { tmdb } from "../tmdb/client.js";
import { fetchBangumiHotAnime } from "./bangumi-scraper.js";
import {
  fetchDoubanHotAnimation,
  fetchDoubanHotMovies,
  fetchDoubanHotTVSeries,
  fetchDoubanHotVarietyShows,
} from "./douban-scraper.js";
import {
  type ContentItem,
  saveBangumiAnimation,
  saveDoubanAnimation,
  saveHotVarietyShows,
  saveMovies,
  saveTVSeries,
} from "./service.js";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface ImageMeta {
  thumb: string | null;
  logo: string | null;
  noLogoPoster: string | null;
}

type ImageEntry = {
  iso_639_1?: string | null;
  iso_3166_1?: string;
  file_path?: string;
  vote_average?: number;
};

function bestByVote(items: ImageEntry[]) {
  return items.length
    ? items.sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0))[0]
    : undefined;
}

async function fetchImageMeta(
  tmdbId: number,
  mediaType: "movie" | "tv",
  backdropPath?: string | null,
  posterPath?: string | null
): Promise<ImageMeta> {
  const fallback: ImageMeta = {
    thumb: backdropPath || posterPath || null,
    logo: null,
    noLogoPoster: null,
  };

  try {
    const result =
      mediaType === "movie"
        ? await tmdb.GET(`/3/movie/${tmdbId}/images`, {
            params: { path: { movie_id: tmdbId } },
          })
        : await tmdb.GET(`/3/tv/${tmdbId}/images`, {
            params: { path: { series_id: tmdbId } },
          });

    const images = result.data;

    const backdrops = (images?.backdrops ?? []) as ImageEntry[];
    const thumb =
      backdrops.find((b) => b.iso_639_1 === "zh")?.file_path ||
      backdrops.find((b) => b.iso_639_1 === "en")?.file_path ||
      backdrops.find((b) => b.iso_639_1 === null)?.file_path ||
      backdrops[0]?.file_path ||
      backdropPath ||
      posterPath ||
      null;

    const logos = (images?.logos ?? []) as ImageEntry[];
    let logo: string | null = null;
    if (logos.length) {
      const regionMatches = logos.filter(
        (l) => l.iso_639_1 === "zh" && l.iso_3166_1 === "CN"
      );
      const langMatches = logos.filter((l) => l.iso_639_1 === "zh");
      const best =
        bestByVote(regionMatches) ??
        bestByVote(langMatches) ??
        bestByVote(logos);
      logo = best?.file_path ?? null;
    }

    const posters = (images?.posters ?? []) as ImageEntry[];
    const noLogoPoster =
      bestByVote(posters.filter((p) => !p.iso_639_1))?.file_path ?? null;

    return { thumb, logo, noLogoPoster };
  } catch (error) {
    console.error(`Failed to fetch images for ${mediaType}/${tmdbId}:`, error);
    return fallback;
  }
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

async function searchTMDB(
  title: string,
  type: "movie" | "tv",
  language = "zh-CN"
) {
  try {
    const path = type === "movie" ? "/3/search/movie" : "/3/search/tv";
    const result = await tmdb.GET(path, {
      params: {
        query: {
          query: title,
          language,
        },
      },
    });

    if (result.data?.results?.[0]) {
      return result.data.results[0];
    }
    return null;
  } catch (error) {
    console.error(`TMDB search error for "${title}":`, error);
    return null;
  }
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
      const tmdbId = tmdbData.id as number;
      const { thumb, logo, noLogoPoster } = await fetchImageMeta(
        tmdbId,
        "movie",
        tmdbData.backdrop_path,
        tmdbData.poster_path
      );

      results.push({
        title: item.title,
        tmdbId,
        vote_average: tmdbData.vote_average,
        poster_path: tmdbData.poster_path,
        backdrop_path: tmdbData.backdrop_path,
        genre_ids: tmdbData.genre_ids || [],
        media_type: "movie",
        release_date: (tmdbData as any)?.release_date || null,
        overview: tmdbData?.overview,
        thumb,
        logo,
        noLogoPoster,
        crawledAt: new Date().toISOString(),
      });
      console.log(`✅ ${tmdbId}`);
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
      } duplicates removed)\n`
    );
  }

  return results;
}

/**
 * Crawl Douban TV series
 */
export async function crawlDoubanTVSeries() {
  console.log("📺 Crawling Douban TV series...");

  const items = await fetchDoubanHotTVSeries();
  console.log(`📥 Found ${items.length} TV series`);

  const results: ContentItem[] = [];

  for (const item of items) {
    console.log(`🔍 Searching: ${item.title}`);

    const tmdbData = await searchTMDB(item.title, "tv");

    if (tmdbData) {
      const tmdbId = tmdbData.id as number;
      const { thumb, logo, noLogoPoster } = await fetchImageMeta(
        tmdbId,
        "tv",
        tmdbData.backdrop_path,
        tmdbData.poster_path
      );

      results.push({
        title: item.title,
        tmdbId,
        vote_average: tmdbData.vote_average,
        poster_path: tmdbData.poster_path,
        backdrop_path: tmdbData.backdrop_path,
        genre_ids: tmdbData.genre_ids || [],
        media_type: "tv",
        first_air_date: (tmdbData as any).first_air_date,
        overview: tmdbData?.overview,
        thumb,
        logo,
        noLogoPoster,
        crawledAt: new Date().toISOString(),
      });
      console.log(`✅ ${tmdbId}`);
    } else {
      console.log(`❌ Not found`);
    }

    await delay(300);
  }

  if (results.length > 0) {
    const deduplicated = deduplicateByTmdbId(results);
    await saveTVSeries(deduplicated);
    console.log(
      `💾 Saved ${deduplicated.length} TV series to JSON (${
        results.length - deduplicated.length
      } duplicates removed)\n`
    );
  }

  return results;
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
    console.log(`🔍 Searching: ${item.title}`);

    const tmdbData = await searchTMDB(item.title, "tv");

    if (tmdbData) {
      const tmdbId = tmdbData.id as number;
      const { thumb, logo, noLogoPoster } = await fetchImageMeta(
        tmdbId,
        "tv",
        tmdbData.backdrop_path,
        tmdbData.poster_path
      );

      results.push({
        title: item.title,
        tmdbId,
        vote_average: tmdbData.vote_average,
        poster_path: tmdbData.poster_path,
        backdrop_path: tmdbData.backdrop_path,
        genre_ids: tmdbData.genre_ids || [],
        media_type: "tv",
        first_air_date: (tmdbData as any).first_air_date,
        overview: tmdbData?.overview,
        thumb,
        logo,
        noLogoPoster,
        crawledAt: new Date().toISOString(),
      });
      console.log(`✅ ${tmdbId}`);
    } else {
      console.log(`❌ Not found`);
    }

    await delay(300);
  }

  if (results.length > 0) {
    const deduplicated = deduplicateByTmdbId(results);
    await saveDoubanAnimation(deduplicated);
    console.log(
      `💾 Saved ${deduplicated.length} animation to JSON (${
        results.length - deduplicated.length
      } duplicates removed)\n`
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
      const tmdbId = tmdbData.id as number;
      const { thumb, logo, noLogoPoster } = await fetchImageMeta(
        tmdbId,
        "tv",
        tmdbData.backdrop_path,
        tmdbData.poster_path
      );

      results.push({
        title: item.title,
        tmdbId,
        vote_average: tmdbData.vote_average,
        poster_path: tmdbData.poster_path,
        backdrop_path: tmdbData.backdrop_path,
        genre_ids: tmdbData.genre_ids || [],
        media_type: "tv",
        first_air_date: (tmdbData as any).first_air_date,
        overview: tmdbData?.overview,
        thumb,
        logo,
        noLogoPoster,
        crawledAt: new Date().toISOString(),
      });
      console.log(`✅ ${tmdbId}`);
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
      } duplicates removed)\n`
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
    console.log(`🔍 Searching: ${item.title}`);

    const tmdbData = await searchTMDB(item.title, "tv");

    if (tmdbData) {
      const tmdbId = tmdbData.id as number;
      const { thumb, logo, noLogoPoster } = await fetchImageMeta(
        tmdbId,
        "tv",
        tmdbData.backdrop_path,
        tmdbData.poster_path
      );

      results.push({
        title: item.title,
        tmdbId,
        vote_average: tmdbData.vote_average,
        poster_path: tmdbData.poster_path,
        backdrop_path: tmdbData.backdrop_path,
        genre_ids: tmdbData.genre_ids || [],
        media_type: "tv",
        first_air_date: (tmdbData as any).first_air_date,
        overview: tmdbData?.overview,
        thumb,
        logo,
        noLogoPoster,
        crawledAt: new Date().toISOString(),
      });
      console.log(`✅ ${tmdbId}`);
    } else {
      console.log(`❌ Not found`);
    }

    await delay(300);
  }

  if (results.length > 0) {
    const deduplicated = deduplicateByTmdbId(results);
    await saveBangumiAnimation(deduplicated);
    console.log(
      `💾 Saved ${deduplicated.length} animation to JSON (${
        results.length - deduplicated.length
      } duplicates removed)\n`
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
  await crawlDoubanAnimation();
  await crawlDoubanHotVarietyShows();
  await crawlBangumiAnimation();

  console.log("✅ Done!");
}

// Run if executed directly
if (process.argv[1]?.includes("crawlers")) {
  runAllCrawlers().catch(console.error);
}
