/**
 * Douban scraper - fetch hot content via API
 */

export interface DoubanItem {
  title: string;
}

const DOUBAN_API_BASE = "https://m.douban.com/rexxar/api/v2/subject_collection";
const DOUBAN_NEW_SEARCH_SUBJECTS =
  "https://movie.douban.com/j/new_search_subjects";
const DOUBAN_SEARCH_SUBJECTS = "https://movie.douban.com/j/search_subjects";

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

interface SearchSubjectsResponse {
  subjects?: Array<{
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
 * Listing from movie.douban.com/j/search_subjects (选电影/选剧集「热门」等).
 */
async function fetchDoubanSearchSubjects(options: {
  type: "movie" | "tv";
  tag: string;
  referer: string;
  pageLimit?: number;
  pageStart?: number;
}): Promise<DoubanItem[]> {
  const { type, tag, referer, pageLimit = 20, pageStart = 0 } = options;
  try {
    const params = new URLSearchParams({
      type,
      tag,
      page_limit: String(pageLimit),
      page_start: String(pageStart),
    });
    const url = `${DOUBAN_SEARCH_SUBJECTS}?${params.toString()}`;
    const response = await fetch(url, {
      headers: {
        ...MOVIE_WEB_HEADERS,
        Referer: referer,
      },
    });

    if (!response.ok) {
      console.error(`Douban search_subjects error: ${response.status}`);
      return [];
    }

    const data = (await response.json()) as SearchSubjectsResponse;
    const items = data.subjects || [];

    return items.map((item) => ({
      title: item.title.split(" ")[0],
    }));
  } catch (error) {
    console.error("Error fetching Douban search_subjects:", error);
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

/**
 * Hot movies: 选电影 explore — 热门 + 全部 (not 华语).
 * Same listing as /j/search_subjects?type=movie&tag=热门
 */
export async function fetchDoubanHotMovies(): Promise<DoubanItem[]> {
  return await fetchDoubanSearchSubjects({
    type: "movie",
    tag: "热门",
    referer:
      "https://movie.douban.com/explore?support_type=movie&is_all=false&category=%E7%83%AD%E9%97%A8&type=%E5%85%A8%E9%83%A8",
  });
}

/**
 * Hot TV (实时热门电视剧/剧集): 选剧集 + tag 热门.
 */
export async function fetchDoubanHotTVSeries(): Promise<DoubanItem[]> {
  return await fetchDoubanSearchSubjects({
    type: "tv",
    tag: "热门",
    referer: "https://movie.douban.com/tv/",
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
