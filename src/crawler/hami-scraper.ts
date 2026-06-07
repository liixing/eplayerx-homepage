/**
 * HamiVideo scraper - fetch Taiwanese TV titles from the public listing page.
 */

export interface HamiItem {
  title: string;
}

const HAMI_TAIWANESE_TV_URL =
  "https://hamivideo.hinet.net/%E5%BD%B1%E5%8A%87%E9%A4%A8%E2%81%BA/%E6%88%B2%E5%8A%87/%E5%8F%B0%E5%8A%87.do?f=new";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
  Referer: "https://hamivideo.hinet.net/",
};

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function normalizeTitle(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]*>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitles(html: string): HamiItem[] {
  const titles = new Set<string>();
  const itemMatches = html.matchAll(
    /<div class="list_item"[\s\S]*?(?=<div class="list_item"|$)/gi
  );

  for (const match of itemMatches) {
    const itemHtml = match[0];
    if (/更新至第\s*0\s*集/.test(itemHtml)) {
      continue;
    }

    const titleMatch = itemHtml.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    const title = normalizeTitle(titleMatch?.[1] || "");
    if (!title || title.includes("{{")) {
      continue;
    }
    titles.add(title);
  }

  return Array.from(titles)
    .slice(0, 20)
    .map((title) => ({ title }));
}

export async function fetchHamiTaiwaneseTVSeries(): Promise<HamiItem[]> {
  try {
    const response = await fetch(HAMI_TAIWANESE_TV_URL, {
      headers: HEADERS,
    });

    if (!response.ok) {
      console.error(`Hami Taiwanese TV page error: ${response.status}`);
      return [];
    }

    const html = await response.text();
    return extractTitles(html);
  } catch (error) {
    console.error("Error fetching Hami Taiwanese TV page:", error);
    return [];
  }
}
