/**
 * iQIYI 风云榜 drama hot list TOP100 (iqiyi.com/ranks1/2/0), via the PC-web
 * rank API (pcw-api.iqiyi.com, 25 entries per page). Realtime heat ranking,
 * refreshed daily. Entry tags look like "2026 / 剧情 自制 / 张新成 丁禹兮" —
 * the leading year disambiguates TMDB search.
 * Submission: iQIYI风云榜热播TOP100 (zh-CN, tv, poster-list) by @冬天等雨.
 *
 * Run: bun run scripts/blocks/daily/iqiyi-hot-tv.ts
 */

import { publishBlock, type PublishItem } from "../../../src/blocks/publish.js";

const API_BASE = "https://pcw-api.iqiyi.com/strategy/pcw/data/topRanksData";
const PAGES = 4; // 25 per page -> TOP100

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
  Referer: "https://www.iqiyi.com/",
  Accept: "application/json",
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Pinned where the bare title hits a foreign show or the wrong entry first
 * (TV search ignores the year hint). Sequels pin the parent series and
 * dedupe into one row. */
const KNOWN_IDS: Record<string, number> = {
  灵魂摆渡: 75480,
  灵魂摆渡2: 75480,
  灵魂摆渡3: 75480,
  唐朝诡事录之长安: 211089,
  深渊: 321036,
  老舅: 277052,
  樊笼: 316780,
};

interface IqiyiRankEntry {
  title?: string;
  tags?: string;
}

interface IqiyiRankResponse {
  data?: {
    formatData?: { data?: { content?: IqiyiRankEntry[] } };
  };
}

async function fetchIqiyiHotTv(): Promise<PublishItem[]> {
  const items: PublishItem[] = [];
  for (let page = 1; page <= PAGES; page++) {
    // category_id=2 (电视剧), tag/page_st=0 (热播榜).
    const url = `${API_BASE}?page_st=0&tag=0&category_id=2&date=&pg_num=${page}`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) {
      throw new Error(`iQIYI rank API error: ${res.status}`);
    }
    const body = (await res.json()) as IqiyiRankResponse;
    const content = body.data?.formatData?.data?.content ?? [];
    for (const entry of content) {
      if (!entry.title) continue;
      const year = Number.parseInt((entry.tags ?? "").slice(0, 4), 10);
      items.push({
        title: entry.title,
        tmdbId: KNOWN_IDS[entry.title],
        ...(Number.isFinite(year) ? { year } : {}),
      });
    }
    await delay(500);
  }
  return items;
}

await publishBlock({
  submissionId: "4dcc7c52200d",
  blockId: "community-iqiyi-hot-tv",
  mediaType: "tv",
  language: "zh-CN",
  useTmdbTitle: true,
  fetchItems: fetchIqiyiHotTv,
});
