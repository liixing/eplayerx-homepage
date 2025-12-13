/**
 * JSON storage service using Cloudflare R2
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

const MOVIES_BLOB_KEY = "douban-movies.json";
const TV_BLOB_KEY = "douban-tv.json";
const DOUBAN_ANIMATION_BLOB_KEY = "douban-animation.json";
const HOT_VARIETY_SHOWS_BLOB_KEY = "douban-hot-variety-shows.json";
const DISCOVER_TV_BY_LANGUAGE_BLOB_KEY = "discover-tv-by-language.json";
const DISCOVER_TV_BY_NETWORK_BLOB_KEY = "discover-tv-by-network.json";

// Validate required environment variables
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
  console.warn(
    "Warning: R2 credentials not fully configured. R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME are required."
  );
}

// Initialize R2 client
// Priority: explicit endpoint > account ID endpoint
const r2Endpoint =
  process.env.R2_ENDPOINT ||
  (process.env.R2_ACCOUNT_ID
    ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    : undefined);

const r2Client = new S3Client({
  region: "auto",
  endpoint: r2Endpoint,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID || "",
    secretAccessKey: R2_SECRET_ACCESS_KEY || "",
  },
  forcePathStyle: true, // Use path-style for R2 endpoint
});

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
  overview?: string | null;
  thumb?: string | null;
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
    // Use custom domain for reading (default: assets.eplayerx.com)
    const customDomain = process.env.R2_CUSTOM_DOMAIN || "assets.eplayerx.com";
    const url = `https://${customDomain}/${pathname}`;
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const text = await response.text();
    return JSON.parse(text) as BlobData;
  } catch (error: any) {
    // If blob doesn't exist (404), return null
    if (error.$metadata?.httpStatusCode === 404) {
      return null;
    }
    // Log other errors for debugging
    if (error.$metadata?.httpStatusCode === 401) {
      console.error(
        "R2 authentication error (401). Please check your R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY environment variables."
      );
    } else {
      console.error("Error loading blob content:", error.message || error);
    }
    return null;
  }
}

/**
 * Save movies to R2
 */
export async function saveMovies(movies: ContentItem[]) {
  if (!R2_BUCKET_NAME) {
    throw new Error("R2_BUCKET_NAME is not configured");
  }

  const data: BlobData = {
    platform: "douban",
    type: "movie",
    count: movies.length,
    lastUpdated: new Date().toISOString(),
    data: movies,
  };
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: MOVIES_BLOB_KEY,
    Body: JSON.stringify(data, null, 2),
    ContentType: "application/json",
  });

  try {
    await r2Client.send(command);
  } catch (error: any) {
    if (error.$metadata?.httpStatusCode === 401) {
      throw new Error(
        "R2 authentication failed (401). Please check your R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY environment variables."
      );
    }
    throw error;
  }
}

/**
 * Save TV series to R2
 */
export async function saveTVSeries(tvSeries: ContentItem[]) {
  if (!R2_BUCKET_NAME) {
    throw new Error("R2_BUCKET_NAME is not configured");
  }

  const data: BlobData = {
    platform: "douban",
    type: "tv_series",
    count: tvSeries.length,
    lastUpdated: new Date().toISOString(),
    data: tvSeries,
  };
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: TV_BLOB_KEY,
    Body: JSON.stringify(data, null, 2),
    ContentType: "application/json",
  });

  try {
    await r2Client.send(command);
  } catch (error: any) {
    if (error.$metadata?.httpStatusCode === 401) {
      throw new Error(
        "R2 authentication failed (401). Please check your R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY environment variables."
      );
    }
    throw error;
  }
}

/**
 * Load movies from R2
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
 * Load TV series from R2
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
 * Save Douban animation to R2
 */
export async function saveDoubanAnimation(animation: ContentItem[]) {
  if (!R2_BUCKET_NAME) {
    throw new Error("R2_BUCKET_NAME is not configured");
  }

  const data: BlobData = {
    platform: "douban",
    type: "animation",
    count: animation.length,
    lastUpdated: new Date().toISOString(),
    data: animation,
  };
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: DOUBAN_ANIMATION_BLOB_KEY,
    Body: JSON.stringify(data, null, 2),
    ContentType: "application/json",
  });

  try {
    await r2Client.send(command);
  } catch (error: any) {
    if (error.$metadata?.httpStatusCode === 401) {
      throw new Error(
        "R2 authentication failed (401). Please check your R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY environment variables."
      );
    }
    throw error;
  }
}

/**
 * Load Douban animation from R2
 */
export async function loadDoubanAnimation(): Promise<ContentItem[]> {
  try {
    const blobData = await loadBlobContent(DOUBAN_ANIMATION_BLOB_KEY);
    return blobData?.data || [];
  } catch (error) {
    console.error("Error loading Douban animation:", error);
    return [];
  }
}

/**
 * Get last update time for Douban animation
 */
export async function getDoubanAnimationLastUpdate(): Promise<string | null> {
  try {
    const blobData = await loadBlobContent(DOUBAN_ANIMATION_BLOB_KEY);
    return blobData?.lastUpdated || null;
  } catch (error) {
    return null;
  }
}

/**
 * Save hot variety shows to R2
 */
export async function saveHotVarietyShows(varietyShows: ContentItem[]) {
  if (!R2_BUCKET_NAME) {
    throw new Error("R2_BUCKET_NAME is not configured");
  }

  const data: BlobData = {
    platform: "douban",
    type: "hot_variety_show",
    count: varietyShows.length,
    lastUpdated: new Date().toISOString(),
    data: varietyShows,
  };
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: HOT_VARIETY_SHOWS_BLOB_KEY,
    Body: JSON.stringify(data, null, 2),
    ContentType: "application/json",
  });

  try {
    await r2Client.send(command);
  } catch (error: any) {
    if (error.$metadata?.httpStatusCode === 401) {
      throw new Error(
        "R2 authentication failed (401). Please check your R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY environment variables."
      );
    }
    throw error;
  }
}

/**
 * Load hot variety shows from R2
 */
export async function loadHotVarietyShows(): Promise<ContentItem[]> {
  try {
    const blobData = await loadBlobContent(HOT_VARIETY_SHOWS_BLOB_KEY);
    return blobData?.data || [];
  } catch (error) {
    console.error("Error loading hot variety shows:", error);
    return [];
  }
}

/**
 * Get last update time for hot variety shows
 */
export async function getHotVarietyShowsLastUpdate(): Promise<string | null> {
  try {
    const blobData = await loadBlobContent(HOT_VARIETY_SHOWS_BLOB_KEY);
    return blobData?.lastUpdated || null;
  } catch (error) {
    return null;
  }
}

// Discover TV by language types
export interface DiscoverTVByLanguageItem {
  language: string;
  languageName: string;
  id: number;
  name: string;
  original_name: string;
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string | null;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
}

interface DiscoverTVByLanguageBlobData {
  type: string;
  count: number;
  lastUpdated: string;
  data: DiscoverTVByLanguageItem[];
}

/**
 * Save discover TV by language to R2
 */
export async function saveDiscoverTVByLanguage(
  items: DiscoverTVByLanguageItem[]
) {
  if (!R2_BUCKET_NAME) {
    throw new Error("R2_BUCKET_NAME is not configured");
  }

  const data: DiscoverTVByLanguageBlobData = {
    type: "discover_tv_by_language",
    count: items.length,
    lastUpdated: new Date().toISOString(),
    data: items,
  };
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: DISCOVER_TV_BY_LANGUAGE_BLOB_KEY,
    Body: JSON.stringify(data, null, 2),
    ContentType: "application/json",
  });

  try {
    await r2Client.send(command);
  } catch (error: any) {
    if (error.$metadata?.httpStatusCode === 401) {
      throw new Error(
        "R2 authentication failed (401). Please check your R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY environment variables."
      );
    }
    throw error;
  }
}

/**
 * Load discover TV by language from R2
 */
export async function loadDiscoverTVByLanguage(): Promise<
  DiscoverTVByLanguageItem[]
> {
  try {
    const blobData = (await loadBlobContent(
      DISCOVER_TV_BY_LANGUAGE_BLOB_KEY
    )) as DiscoverTVByLanguageBlobData | null;
    return blobData?.data || [];
  } catch (error) {
    console.error("Error loading discover TV by language:", error);
    return [];
  }
}

/**
 * Get last update time for discover TV by language
 */
export async function getDiscoverTVByLanguageLastUpdate(): Promise<
  string | null
> {
  try {
    const blobData = await loadBlobContent(DISCOVER_TV_BY_LANGUAGE_BLOB_KEY);
    return blobData?.lastUpdated || null;
  } catch (error) {
    return null;
  }
}

// Discover TV by network types
export interface DiscoverTVByNetworkItem {
  networkId: number;
  networkName: string;
  networkLogoPath: string | null;
  id: number;
  name: string;
  original_name: string;
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string | null;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
}

interface DiscoverTVByNetworkBlobData {
  type: string;
  count: number;
  lastUpdated: string;
  data: DiscoverTVByNetworkItem[];
}

/**
 * Save discover TV by network to R2
 */
export async function saveDiscoverTVByNetwork(
  items: DiscoverTVByNetworkItem[]
) {
  if (!R2_BUCKET_NAME) {
    throw new Error("R2_BUCKET_NAME is not configured");
  }

  const data: DiscoverTVByNetworkBlobData = {
    type: "discover_tv_by_network",
    count: items.length,
    lastUpdated: new Date().toISOString(),
    data: items,
  };
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: DISCOVER_TV_BY_NETWORK_BLOB_KEY,
    Body: JSON.stringify(data, null, 2),
    ContentType: "application/json",
  });

  try {
    await r2Client.send(command);
  } catch (error: any) {
    if (error.$metadata?.httpStatusCode === 401) {
      throw new Error(
        "R2 authentication failed (401). Please check your R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY environment variables."
      );
    }
    throw error;
  }
}

/**
 * Load discover TV by network from R2
 */
export async function loadDiscoverTVByNetwork(): Promise<
  DiscoverTVByNetworkItem[]
> {
  try {
    const blobData = (await loadBlobContent(
      DISCOVER_TV_BY_NETWORK_BLOB_KEY
    )) as DiscoverTVByNetworkBlobData | null;
    return blobData?.data || [];
  } catch (error) {
    console.error("Error loading discover TV by network:", error);
    return [];
  }
}

/**
 * Get last update time for discover TV by network
 */
export async function getDiscoverTVByNetworkLastUpdate(): Promise<
  string | null
> {
  try {
    const blobData = await loadBlobContent(DISCOVER_TV_BY_NETWORK_BLOB_KEY);
    return blobData?.lastUpdated || null;
  } catch (error) {
    return null;
  }
}
