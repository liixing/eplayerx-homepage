/**
 * JSON storage service using Vercel Blob
 */

import { put, head } from "@vercel/blob";

const MOVIES_BLOB_KEY = "douban-movies.json";
const TV_BLOB_KEY = "douban-tv.json";
const BILIBILI_BLOB_KEY = "bilibili-anime.json";
const BILIBILI_GUOCHUANG_BLOB_KEY = "bilibili-guochuang.json";

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

interface BlobData {
  platform: string;
  type: string;
  count: number;
  lastUpdated: string;
  data: ContentItem[];
}

/**
 * Load blob content by pathname
 */
async function loadBlobContent(pathname: string): Promise<BlobData | null> {
  try {
    const blobInfo = await head(pathname);
    const response = await fetch(blobInfo.url);
    if (!response.ok) {
      return null;
    }
    const text = await response.text();
    return JSON.parse(text) as BlobData;
  } catch (error) {
    // If blob doesn't exist, return null
    return null;
  }
}

/**
 * Save movies to Blob
 */
export async function saveMovies(movies: ContentItem[]) {
  const data: BlobData = {
    platform: "douban",
    type: "movie",
    count: movies.length,
    lastUpdated: new Date().toISOString(),
    data: movies,
  };
  await put(MOVIES_BLOB_KEY, JSON.stringify(data, null, 2), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

/**
 * Save TV series to Blob
 */
export async function saveTVSeries(tvSeries: ContentItem[]) {
  const data: BlobData = {
    platform: "douban",
    type: "tv_series",
    count: tvSeries.length,
    lastUpdated: new Date().toISOString(),
    data: tvSeries,
  };
  await put(TV_BLOB_KEY, JSON.stringify(data, null, 2), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

/**
 * Load movies from Blob
 */
export async function loadMovies(): Promise<ContentItem[]> {
  try {
    const blobData = await loadBlobContent(MOVIES_BLOB_KEY);
    return blobData?.data || [];
  } catch (error) {
    console.error("Error loading movies:", error);
    return [];
  }
}

/**
 * Load TV series from Blob
 */
export async function loadTVSeries(): Promise<ContentItem[]> {
  try {
    const blobData = await loadBlobContent(TV_BLOB_KEY);
    return blobData?.data || [];
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
    const blobData = await loadBlobContent(MOVIES_BLOB_KEY);
    return blobData?.lastUpdated || null;
  } catch (error) {
    return null;
  }
}

/**
 * Get last update time for TV series
 */
export async function getTVSeriesLastUpdate(): Promise<string | null> {
  try {
    const blobData = await loadBlobContent(TV_BLOB_KEY);
    return blobData?.lastUpdated || null;
  } catch (error) {
    return null;
  }
}

/**
 * Save Bilibili anime to Blob
 */
export async function saveBilibiliAnime(anime: ContentItem[]) {
  const data: BlobData = {
    platform: "bilibili",
    type: "anime",
    count: anime.length,
    lastUpdated: new Date().toISOString(),
    data: anime,
  };
  await put(BILIBILI_BLOB_KEY, JSON.stringify(data, null, 2), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

/**
 * Load Bilibili anime from Blob
 */
export async function loadBilibiliAnime(): Promise<ContentItem[]> {
  try {
    const blobData = await loadBlobContent(BILIBILI_BLOB_KEY);
    return blobData?.data || [];
  } catch (error) {
    console.error("Error loading Bilibili anime:", error);
    return [];
  }
}

/**
 * Get last update time for Bilibili anime
 */
export async function getBilibiliAnimeLastUpdate(): Promise<string | null> {
  try {
    const blobData = await loadBlobContent(BILIBILI_BLOB_KEY);
    return blobData?.lastUpdated || null;
  } catch (error) {
    return null;
  }
}

/**
 * Save Bilibili guochuang to Blob
 */
export async function saveBilibiliGuochuang(guochuang: ContentItem[]) {
  const data: BlobData = {
    platform: "bilibili",
    type: "guochuang",
    count: guochuang.length,
    lastUpdated: new Date().toISOString(),
    data: guochuang,
  };
  await put(BILIBILI_GUOCHUANG_BLOB_KEY, JSON.stringify(data, null, 2), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

/**
 * Load Bilibili guochuang from Blob
 */
export async function loadBilibiliGuochuang(): Promise<ContentItem[]> {
  try {
    const blobData = await loadBlobContent(BILIBILI_GUOCHUANG_BLOB_KEY);
    return blobData?.data || [];
  } catch (error) {
    console.error("Error loading Bilibili guochuang:", error);
    return [];
  }
}

/**
 * Get last update time for Bilibili guochuang
 */
export async function getBilibiliGuochuangLastUpdate(): Promise<string | null> {
  try {
    const blobData = await loadBlobContent(BILIBILI_GUOCHUANG_BLOB_KEY);
    return blobData?.lastUpdated || null;
  } catch (error) {
    return null;
  }
}
