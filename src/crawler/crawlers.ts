/**
 * Main crawler: Douban -> TMDB -> JSON file
 */

import { tmdb } from "../tmdb/client.js";
import {
  fetchBilibiliHotAnime,
  fetchBilibiliHotGuochuang,
} from "./bilibili-scraper.js";
import {
  fetchDoubanHotMovies,
  fetchDoubanHotTVSeries,
} from "./douban-scraper.js";
import {
  type ContentItem,
  saveBilibiliAnime,
  saveBilibiliGuochuang,
  saveMovies,
  saveTVSeries,
} from "./service.js";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
      results.push({
        title: item.title,
        tmdbId: tmdbData.id as number,
        vote_average: tmdbData.vote_average,
        poster_path: tmdbData.poster_path,
        backdrop_path: tmdbData.backdrop_path,
        genre_ids: tmdbData.genre_ids || [],
        media_type: "movie",
        release_date: (tmdbData as any)?.release_date || null,
        overview: tmdbData?.overview,
        crawledAt: new Date().toISOString(),
      });
      console.log(`✅ ${tmdbData.id}`);
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
      results.push({
        title: item.title,
        tmdbId: tmdbData.id as number,
        vote_average: tmdbData.vote_average,
        poster_path: tmdbData.poster_path,
        backdrop_path: tmdbData.backdrop_path,
        genre_ids: tmdbData.genre_ids || [],
        media_type: "tv",
        first_air_date: (tmdbData as any).first_air_date,
        overview: tmdbData?.overview,
        crawledAt: new Date().toISOString(),
      });
      console.log(`✅ ${tmdbData.id}`);
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
 * Crawl Bilibili anime
 */
export async function crawlBilibiliAnime() {
  console.log("📺 Crawling Bilibili anime...");

  const items = await fetchBilibiliHotAnime();
  console.log(`📥 Found ${items.length} anime`);

  const results: ContentItem[] = [];

  for (const item of items) {
    console.log(`🔍 Searching: ${item.title}`);

    const tmdbData = await searchTMDB(item.title, "tv");

    if (tmdbData) {
      results.push({
        title: item.title,
        tmdbId: tmdbData.id as number,
        vote_average: tmdbData.vote_average,
        poster_path: tmdbData.poster_path,
        backdrop_path: tmdbData.backdrop_path,
        genre_ids: tmdbData.genre_ids || [],
        media_type: "tv",
        first_air_date: (tmdbData as any).first_air_date,
        overview: tmdbData?.overview,
        crawledAt: new Date().toISOString(),
      });
      console.log(`✅ ${tmdbData.id}`);
    } else {
      console.log(`❌ Not found`);
    }

    await delay(300);
  }

  if (results.length > 0) {
    const deduplicated = deduplicateByTmdbId(results);
    await saveBilibiliAnime(deduplicated);
    console.log(
      `💾 Saved ${deduplicated.length} anime to JSON (${
        results.length - deduplicated.length
      } duplicates removed)\n`
    );
  }

  return results;
}

/**
 * Crawl Bilibili guochuang
 */
export async function crawlBilibiliGuochuang() {
  console.log("🇨🇳 Crawling Bilibili guochuang...");

  const items = await fetchBilibiliHotGuochuang();
  console.log(`📥 Found ${items.length} guochuang`);

  const results: ContentItem[] = [];

  for (const item of items) {
    console.log(`🔍 Searching: ${item.title}`);

    const tmdbData = await searchTMDB(item.title, "tv");

    if (tmdbData) {
      results.push({
        title: item.title,
        tmdbId: tmdbData.id as number,
        vote_average: tmdbData.vote_average,
        poster_path: tmdbData.poster_path,
        backdrop_path: tmdbData.backdrop_path,
        genre_ids: tmdbData.genre_ids || [],
        media_type: "tv",
        first_air_date: (tmdbData as any).first_air_date,
        overview: tmdbData?.overview,
        crawledAt: new Date().toISOString(),
      });
      console.log(`✅ ${tmdbData.id}`);
    } else {
      console.log(`❌ Not found`);
    }

    await delay(300);
  }

  if (results.length > 0) {
    const deduplicated = deduplicateByTmdbId(results);
    await saveBilibiliGuochuang(deduplicated);
    console.log(
      `💾 Saved ${deduplicated.length} guochuang to JSON (${
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
  await crawlBilibiliAnime();
  await crawlBilibiliGuochuang();

  console.log("✅ Done!");
}

// Run if executed directly
if (process.argv[1]?.includes("crawlers")) {
  runAllCrawlers().catch(console.error);
}
