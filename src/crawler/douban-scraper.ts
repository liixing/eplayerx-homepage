/**
 * Douban scraper - fetch hot content via API
 */

export interface DoubanItem {
  title: string;
}

const DOUBAN_API_BASE = "https://m.douban.com/rexxar/api/v2/subject_collection";
const DOUBAN_RECENT_HOT_MOVIE =
  "https://m.douban.com/rexxar/api/v2/subject/recent_hot/movie";
const DOUBAN_RECENT_HOT_TV =
  "https://m.douban.com/rexxar/api/v2/subject/recent_hot/tv";
const DOUBAN_NEW_SEARCH_SUBJECTS =
  "https://movie.douban.com/j/new_search_subjects";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
  Accept: "application/json",
};

/** Desktop UA + Referer for movie.douban.com explore JSON (matches web listing). */
const MOVIE_WEB_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json",
};

interface DoubanApiResponse {
  subject_collection_items?: Array<{
    title: string;
  }>;
}

interface NewSearchSubjectsResponse {
  data?: Array<{
    title: string;
  }>;
}

interface RecentHotListResponse {
  items?: Array<{
    title: string;
  }>;
}

/**
 * Fetch Douban collection via API
 */
async function fetchDoubanCollection(
  collectionId: string
): Promise<DoubanItem[]> {
  try {
    const url = `${DOUBAN_API_BASE}/${collectionId}/items?start=0&count=20`;
    const response = await fetch(url, {
      headers: {
        ...HEADERS,
        Referer: `https://m.douban.com/subject_collection/${collectionId}`,
      },
    });

    if (!response.ok) {
      console.error(`Douban API error: ${response.status}`);
      return [];
    }

    const data = (await response.json()) as DoubanApiResponse;
    const items = data.subject_collection_items || [];

    return items.map((item) => ({
      title: item.title.split(" ")[0],
    }));
  } catch (error) {
    console.error("Error fetching Douban:", error);
    return [];
  }
}

/**
 * Same listing as movie.douban.com/tv explore (e.g. category=show → tag 综艺).
 */
async function fetchDoubanNewSearchSubjects(options: {
  tags: string;
  referer: string;
  start?: number;
}): Promise<DoubanItem[]> {
  const { tags, referer, start = 0 } = options;
  try {
    const params = new URLSearchParams({
      sort: "U",
      range: "0,10",
      tags,
      start: String(start),
      genres: "",
      countries: "",
      year_range: "",
      playable: "",
      unwatchable: "",
    });
    const url = `${DOUBAN_NEW_SEARCH_SUBJECTS}?${params.toString()}`;
    const response = await fetch(url, {
      headers: {
        ...MOVIE_WEB_HEADERS,
        Referer: referer,
      },
    });

    if (!response.ok) {
      console.error(`Douban new_search_subjects error: ${response.status}`);
      return [];
    }

    const data = (await response.json()) as NewSearchSubjectsResponse;
    const items = data.data || [];

    return items.map((item) => ({
      title: item.title.split(" ")[0],
    }));
  } catch (error) {
    console.error("Error fetching Douban new_search_subjects:", error);
    return [];
  }
}

async function fetchDoubanRecentHot(options: {
  kind: "movie" | "tv";
  query: Record<string, string>;
}): Promise<DoubanItem[]> {
  const base =
    options.kind === "movie" ? DOUBAN_RECENT_HOT_MOVIE : DOUBAN_RECENT_HOT_TV;
  try {
    const params = new URLSearchParams({
      start: "0",
      limit: "20",
      ...options.query,
    });
    const url = `${base}?${params.toString()}`;
    const response = await fetch(url, {
      headers: {
        ...HEADERS,
        Referer: "https://m.douban.com/",
      },
    });

    if (!response.ok) {
      console.error(
        `Douban recent_hot/${options.kind} error: ${response.status}`
      );
      return [];
    }

    const data = (await response.json()) as RecentHotListResponse;
    const items = data.items || [];

    return items.map((item) => ({
      title: item.title.split(" ")[0],
    }));
  } catch (error) {
    console.error(`Error fetching Douban recent_hot/${options.kind}:`, error);
    return [];
  }
}

/**
 * Hot movies: m.douban rexxar recent_hot (热门 + 华语).
 */
export async function fetchDoubanHotMovies(): Promise<DoubanItem[]> {
  return fetchDoubanRecentHot({
    kind: "movie",
    query: { category: "热门", type: "华语" },
  });
}

/**
 * Domestic TV dramas: m.douban rexxar recent_hot (国产剧 tab).
 */
export async function fetchDoubanHotTVSeries(): Promise<DoubanItem[]> {
  return fetchDoubanRecentHot({
    kind: "tv",
    query: { category: "tv", type: "tv_domestic" },
  });
}

/**
 * Fetch hot animation from Douban
 */
export async function fetchDoubanHotAnimation(): Promise<DoubanItem[]> {
  return await fetchDoubanCollection("tv_animation");
}

/**
 * Hot variety shows: same source as
 * movie.douban.com/tv/?support_type=tv&is_all=false&category=show&type=show
 * (tag 综艺 via /j/new_search_subjects).
 */
export async function fetchDoubanHotVarietyShows(): Promise<DoubanItem[]> {
  return await fetchDoubanNewSearchSubjects({
    tags: "综艺",
    referer:
      "https://movie.douban.com/tv/?support_type=tv&is_all=false&category=show&type=show",
  });
}
