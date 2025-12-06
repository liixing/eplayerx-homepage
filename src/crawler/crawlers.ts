/**
 * Main crawler: Douban -> TMDB -> JSON file
 */

import { tmdb } from "../tmdb/client.js";
import { getThumbFromImages } from "../tmdb/utils.js";
import {
  fetchDoubanHotMovies,
  fetchDoubanHotTVSeries,
  fetchDoubanHotAnimation,
} from "./douban-scraper.js";
import {
  type ContentItem,
  saveDoubanAnimation,
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
      const tmdbId = tmdbData.id as number;
      const thumb = await getThumbFromImages(tmdbId, "movie", "zh");

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
        thumb: thumb || null,
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
      const thumb = await getThumbFromImages(tmdbId, "tv", "zh");

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
        thumb: thumb || null,
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
      const thumb = await getThumbFromImages(tmdbId, "tv", "zh");

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
        thumb: thumb || null,
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
 * Run all crawlers
 */
async function runAllCrawlers() {
  console.log("🚀 Starting crawlers...\n");

  await crawlDoubanMovies();
  await crawlDoubanTVSeries();
  await crawlDoubanAnimation();

  console.log("✅ Done!");
}

// Run if executed directly
if (process.argv[1]?.includes("crawlers")) {
  runAllCrawlers().catch(console.error);
}
