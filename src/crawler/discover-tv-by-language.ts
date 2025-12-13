/**
 * Discover TV shows by original language from TMDB
 * Fetches the first TV show for each language: en, zh, ja, ko, es, th, hi
 */

import { tmdb } from "../tmdb/client.js";
import {
  type DiscoverTVByLanguageItem,
  saveDiscoverTVByLanguage,
} from "./service.js";

// Language codes mapping
const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "zh", name: "Chinese" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "es", name: "Spanish" },
  { code: "th", name: "Thai" },
  { code: "hi", name: "Hindi" },
] as const;

/**
 * Fetch top TV show by original language
 */
async function fetchTVByLanguage(
  languageCode: string
): Promise<DiscoverTVByLanguageItem | null> {
  try {
    const result = await tmdb.GET("/3/discover/tv", {
      params: {
        query: {
          language: "zh-CN",
          with_original_language: languageCode,
          page: 1,
        },
      },
    });

    if (result.data?.results?.[0]) {
      const tv = result.data.results[0];
      const lang = LANGUAGES.find((l) => l.code === languageCode);

      return {
        language: languageCode,
        languageName: lang?.name || languageCode,
        id: tv.id as number,
        name: tv.name || "",
        original_name: tv.original_name || "",
        overview: tv.overview || null,
        poster_path: tv.poster_path || null,
        backdrop_path: tv.backdrop_path || null,
        first_air_date: tv.first_air_date || null,
        vote_average: tv.vote_average || 0,
        vote_count: tv.vote_count || 0,
        genre_ids: tv.genre_ids || [],
      };
    }

    return null;
  } catch (error) {
    console.error(`Error fetching TV for language "${languageCode}":`, error);
    return null;
  }
}

/**
 * Discover TV shows by all configured languages
 */
export async function discoverTVByLanguages(): Promise<
  DiscoverTVByLanguageItem[]
> {
  console.log("🌍 Discovering TV shows by language...\n");

  const results: DiscoverTVByLanguageItem[] = [];

  for (const lang of LANGUAGES) {
    console.log(`🔍 Fetching ${lang.name} (${lang.code})...`);

    const tv = await fetchTVByLanguage(lang.code);

    if (tv) {
      results.push(tv);
      console.log(`✅ Found: ${tv.name} (${tv.original_name})`);
    } else {
      console.log(`❌ No result for ${lang.name}`);
    }
  }

  console.log(`\n📊 Total: ${results.length} TV shows found`);

  return results;
}

// Run if executed directly
async function main() {
  const results = await discoverTVByLanguages();

  if (results.length > 0) {
    await saveDiscoverTVByLanguage(results);
    console.log(`\n💾 Saved ${results.length} TV shows to Cloudflare R2`);
  }

  console.log("\n📋 Results:\n");
  console.log(JSON.stringify(results, null, 2));

  return results;
}

if (process.argv[1]?.includes("discover-tv-by-language")) {
  main().catch(console.error);
}
