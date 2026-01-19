/**
 * Bangumi scraper - fetch hot anime via HTML parsing
 */

export interface BangumiItem {
  title: string;
}

const BANGUMI_URL = "https://bangumi.tv/anime/browser/?sort=trends";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

/**
 * Fetch hot anime from Bangumi (top 20 by trends)
 */
export async function fetchBangumiHotAnime(): Promise<BangumiItem[]> {
  try {
    const response = await fetch(BANGUMI_URL, { headers: HEADERS });

    if (!response.ok) {
      console.error(`Bangumi request error: ${response.status}`);
      return [];
    }

    const html = await response.text();

    // Extract titles from <h3>...<a href="/subject/..." class="l">Title</a>...</h3>
    const titleRegex = /<h3>\s*(?:<[^>]*>\s*)*<a\s+href="\/subject\/\d+"\s+class="l">([^<]+)<\/a>/g;
    const items: BangumiItem[] = [];
    const titleSet = new Set<string>();

    let match: RegExpExecArray | null;
    while ((match = titleRegex.exec(html)) !== null && items.length < 20) {
      const fullTitle = match[1].trim();
      if (fullTitle) {
        // Only keep content before the first space (Chinese title)
        const title = fullTitle.split(" ")[0];
        if (title && !titleSet.has(title)) {
          titleSet.add(title);
          items.push({ title });
        }
      }
    }

    return items;
  } catch (error) {
    console.error("Error fetching Bangumi:", error);
    return [];
  }
}
