/**
 * Douban scraper - fetch hot content via API
 */

export interface DoubanItem {
  title: string;
}

const DOUBAN_API_BASE = "https://m.douban.com/rexxar/api/v2/subject_collection";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
  Accept: "application/json",
};

interface DoubanApiResponse {
  subject_collection_items?: Array<{
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
      title: item.title,
    }));
  } catch (error) {
    console.error("Error fetching Douban:", error);
    return [];
  }
}

/**
 * Fetch hot movies from Douban
 */
export async function fetchDoubanHotMovies(): Promise<DoubanItem[]> {
  return await fetchDoubanCollection("movie_real_time_hotest");
}

/**
 * Fetch hot TV series from Douban
 */
export async function fetchDoubanHotTVSeries(): Promise<DoubanItem[]> {
  return await fetchDoubanCollection("tv_real_time_hotest");
}

/**
 * Fetch hot animation from Douban
 */
export async function fetchDoubanHotAnimation(): Promise<DoubanItem[]> {
  return await fetchDoubanCollection("tv_animation");
}

/**
 * Fetch hot variety shows from Douban (recent hot)
 */
export async function fetchDoubanHotVarietyShows(): Promise<DoubanItem[]> {
  return await fetchDoubanCollection("show_hot");
}
