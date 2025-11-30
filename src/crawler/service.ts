/**
 * JSON file storage service
 */

import { writeFile, readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = "./data";
const MOVIES_FILE = join(DATA_DIR, "douban-movies.json");
const TV_FILE = join(DATA_DIR, "douban-tv.json");

export interface ContentItem {
  title: string;
  tmdbId: number;
  vote_average: number | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  genre_ids: number[];
  media_type: "movie" | "tv";
  release_date?: string | null;
  first_air_date?: string | null;
  crawledAt: string;
}

/**
 * Ensure data directory exists
 */
async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

/**
 * Save movies to JSON file
 */
export async function saveMovies(movies: ContentItem[]) {
  await ensureDataDir();
  const data = {
    platform: "douban",
    type: "movie",
    count: movies.length,
    lastUpdated: new Date().toISOString(),
    data: movies,
  };
  await writeFile(MOVIES_FILE, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * Save TV series to JSON file
 */
export async function saveTVSeries(tvSeries: ContentItem[]) {
  await ensureDataDir();
  const data = {
    platform: "douban",
    type: "tv_series",
    count: tvSeries.length,
    lastUpdated: new Date().toISOString(),
    data: tvSeries,
  };
  await writeFile(TV_FILE, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * Load movies from JSON file
 */
export async function loadMovies(): Promise<ContentItem[]> {
  try {
    if (!existsSync(MOVIES_FILE)) {
      return [];
    }
    const content = await readFile(MOVIES_FILE, "utf-8");
    const json = JSON.parse(content);
    return json.data || [];
  } catch (error) {
    console.error("Error loading movies:", error);
    return [];
  }
}

/**
 * Load TV series from JSON file
 */
export async function loadTVSeries(): Promise<ContentItem[]> {
  try {
    if (!existsSync(TV_FILE)) {
      return [];
    }
    const content = await readFile(TV_FILE, "utf-8");
    const json = JSON.parse(content);
    return json.data || [];
  } catch (error) {
    console.error("Error loading TV series:", error);
    return [];
  }
}

/**
 * Get last update time for movies
 */
export async function getMoviesLastUpdate(): Promise<string | null> {
  try {
    if (!existsSync(MOVIES_FILE)) {
      return null;
    }
    const content = await readFile(MOVIES_FILE, "utf-8");
    const json = JSON.parse(content);
    return json.lastUpdated || null;
  } catch (error) {
    return null;
  }
}

/**
 * Get last update time for TV series
 */
export async function getTVSeriesLastUpdate(): Promise<string | null> {
  try {
    if (!existsSync(TV_FILE)) {
      return null;
    }
    const content = await readFile(TV_FILE, "utf-8");
    const json = JSON.parse(content);
    return json.lastUpdated || null;
  } catch (error) {
    return null;
  }
}
