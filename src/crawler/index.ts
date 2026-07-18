/// <reference types="@cloudflare/workers-types" />
import { type Context, Hono } from "hono";
import {
  crawlBangumiAnimation,
  crawlDoubanAnimation,
  crawlDoubanJapaneseTVSeries,
  crawlDoubanKoreanTVSeries,
  crawlDoubanHotVarietyShows,
  crawlDoubanMovies,
  crawlDoubanTVSeries,
  crawlHamiTaiwaneseTVSeries,
} from "./crawlers.js";

const R2_CUSTOM_DOMAIN = process.env.R2_CUSTOM_DOMAIN || "assets.eplayerx.com";

/** Cron-refreshed charts — long edge TTL is safe. */
const STATIC_JSON_CACHE_CONTROL =
  "public, max-age=3600, s-maxage=3600, stale-while-revalidate=21600";

type CrawlerBindings = {
  ASSETS?: R2Bucket;
};

type CrawlerContext = Context<{ Bindings: CrawlerBindings }>;

const app = new Hono<{ Bindings: CrawlerBindings }>();

function defaultCache(): Cache | null {
  if (typeof caches === "undefined") return null;
  return (caches as unknown as { default?: Cache }).default ?? null;
}

/**
 * Prefer the Workers R2 binding (no CDN hop). Fall back to the public
 * custom-domain URL when ASSETS is unbound (local Bun / Docker).
 */
async function serveStaticR2Json(
  c: CrawlerContext,
  key: string
): Promise<Response> {
  const result = await readStaticR2Object(c, key);
  if (!result) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": STATIC_JSON_CACHE_CONTROL,
      },
    });
  }
  if (result.kind === "http" && !result.response.ok) {
    return new Response(result.response.body, {
      status: result.response.status,
      headers: {
        "Content-Type":
          result.response.headers.get("Content-Type") || "application/json",
        "Cache-Control": STATIC_JSON_CACHE_CONTROL,
      },
    });
  }
  const body =
    result.kind === "r2" ? result.object.body : result.response.body;
  const contentType =
    result.kind === "r2"
      ? result.object.httpMetadata?.contentType || "application/json"
      : result.response.headers.get("Content-Type") || "application/json";
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": STATIC_JSON_CACHE_CONTROL,
    },
  });
}

async function readStaticR2Json(
  c: CrawlerContext,
  key: string
): Promise<{ ok: true; data: unknown } | { ok: false; response: Response }> {
  const result = await readStaticR2Object(c, key);
  if (!result) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": STATIC_JSON_CACHE_CONTROL,
        },
      }),
    };
  }
  if (result.kind === "http" && !result.response.ok) {
    return {
      ok: false,
      response: new Response(result.response.body, {
        status: result.response.status,
        headers: {
          "Content-Type":
            result.response.headers.get("Content-Type") || "application/json",
          "Cache-Control": STATIC_JSON_CACHE_CONTROL,
        },
      }),
    };
  }
  const data =
    result.kind === "r2"
      ? await result.object.json()
      : await result.response.json();
  return { ok: true, data };
}

async function readStaticR2Object(
  c: CrawlerContext,
  key: string
): Promise<
  | { kind: "r2"; object: R2ObjectBody }
  | { kind: "http"; response: Response }
  | null
> {
  const bucket = c.env.ASSETS;
  if (bucket) {
    const object = await bucket.get(key);
    return object ? { kind: "r2", object } : null;
  }
  const response = await fetch(`https://${R2_CUSTOM_DOMAIN}/${key}`);
  if (response.status === 404) return null;
  return { kind: "http", response };
}

/** Edge-cache GET responses for popular / discover chart routes. */
async function staticJsonCacheMiddleware(
  c: CrawlerContext,
  next: () => Promise<void>
) {
  if (c.req.method !== "GET" && c.req.method !== "HEAD") {
    return next();
  }
  const cache = defaultCache();
  if (!cache) {
    return next();
  }
  const cacheKey = new Request(c.req.url, { method: "GET" });
  const hit = await cache.match(cacheKey);
  if (hit) {
    const headers = new Headers(hit.headers);
    if (!headers.has("Cache-Control")) {
      headers.set("Cache-Control", STATIC_JSON_CACHE_CONTROL);
    }
    return new Response(c.req.method === "HEAD" ? null : hit.body, {
      status: hit.status,
      headers,
    });
  }
  await next();
  if (c.req.method === "GET" && c.res.ok) {
    if (!c.res.headers.has("Cache-Control")) {
      c.header("Cache-Control", STATIC_JSON_CACHE_CONTROL);
    }
    c.executionCtx.waitUntil(cache.put(cacheKey, c.res.clone()));
  }
}

app.use("/popular/*", staticJsonCacheMiddleware);
app.use("/discover/*", staticJsonCacheMiddleware);

type Locale = "en" | "zh" | "zh-Hant" | "ja" | "es" | "ar";

interface TmdbListRoute {
  type: "tmdb-list";
  title: string;
  params: {
    category: "discover";
    type: "movie" | "tv";
    genre?: string;
    language?: string;
    network?: string;
    networkName?: string;
  };
}

interface DiscoverTVByLanguageItem {
  language: string;
  languageName?: string;
  title?: string;
  route?: TmdbListRoute;
  id: number;
  name?: string;
  original_name?: string;
  overview?: string | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  first_air_date?: string | null;
  vote_average?: number;
  vote_count?: number;
  genre_ids?: number[];
}

interface DiscoverTVByLanguageResponse {
  type?: string;
  count?: number;
  lastUpdated?: string;
  data?: DiscoverTVByLanguageItem[];
}

type GenreKey =
  | "drama"
  | "comedy"
  | "thriller"
  | "action"
  | "animation"
  | "crime"
  | "documentary"
  | "kids"
  | "scifi"
  | "romance"
  | "war";

interface DiscoverGenreItem {
  id: string;
  title: string;
  imageUri: string;
  route: TmdbListRoute;
}

interface DiscoverGenresResponse {
  type: "discover_genres";
  count: number;
  data: DiscoverGenreItem[];
}

interface DiscoverTVByNetworkItem {
  networkId: number;
  networkName: string;
  title?: string;
  route?: TmdbListRoute;
  [key: string]: unknown;
}

interface DiscoverTVByNetworkResponse {
  type?: string;
  count?: number;
  lastUpdated?: string;
  data?: DiscoverTVByNetworkItem[];
}

const LANGUAGE_NAME_TRANSLATIONS: Record<string, Record<Locale, string>> = {
  en: {
    en: "English",
    zh: "英语",
    "zh-Hant": "英語",
    ja: "英語",
    es: "Inglés",
    ar: "الإنجليزية",
  },
  zh: {
    en: "Chinese",
    zh: "中文",
    "zh-Hant": "中文",
    ja: "中国語",
    es: "Chino",
    ar: "الصينية",
  },
  ja: {
    en: "Japanese",
    zh: "日语",
    "zh-Hant": "日語",
    ja: "日本語",
    es: "Japonés",
    ar: "اليابانية",
  },
  ko: {
    en: "Korean",
    zh: "韩语",
    "zh-Hant": "韓語",
    ja: "韓国語",
    es: "Coreano",
    ar: "الكورية",
  },
  es: {
    en: "Spanish",
    zh: "西班牙语",
    "zh-Hant": "西班牙語",
    ja: "スペイン語",
    es: "Español",
    ar: "الإسبانية",
  },
  th: {
    en: "Thai",
    zh: "泰语",
    "zh-Hant": "泰語",
    ja: "タイ語",
    es: "Tailandés",
    ar: "التايلاندية",
  },
  hi: {
    en: "Hindi",
    zh: "印度语",
    "zh-Hant": "印度語",
    ja: "ヒンディー語",
    es: "Hindi",
    ar: "الهندية",
  },
  tr: {
    en: "Turkish",
    zh: "土耳其语",
    "zh-Hant": "土耳其語",
    ja: "トルコ語",
    es: "Turco",
    ar: "التركية",
  },
  ar: {
    en: "Arabic",
    zh: "阿拉伯语",
    "zh-Hant": "阿拉伯語",
    ja: "アラビア語",
    es: "Árabe",
    ar: "العربية",
  },
  fr: {
    en: "French",
    zh: "法语",
    "zh-Hant": "法語",
    ja: "フランス語",
    es: "Francés",
    ar: "الفرنسية",
  },
  it: {
    en: "Italian",
    zh: "意大利语",
    "zh-Hant": "義大利語",
    ja: "イタリア語",
    es: "Italiano",
    ar: "الإيطالية",
  },
  de: {
    en: "German",
    zh: "德语",
    "zh-Hant": "德語",
    ja: "ドイツ語",
    es: "Alemán",
    ar: "الألمانية",
  },
  nl: {
    en: "Dutch",
    zh: "荷兰语",
    "zh-Hant": "荷蘭語",
    ja: "オランダ語",
    es: "Neerlandés",
    ar: "الهولندية",
  },
  ru: {
    en: "Russian",
    zh: "俄语",
    "zh-Hant": "俄語",
    ja: "ロシア語",
    es: "Ruso",
    ar: "الروسية",
  },
  pt: {
    en: "Portuguese",
    zh: "葡萄牙语",
    "zh-Hant": "葡萄牙語",
    ja: "ポルトガル語",
    es: "Portugués",
    ar: "البرتغالية",
  },
  vi: {
    en: "Vietnamese",
    zh: "越南语",
    "zh-Hant": "越南語",
    ja: "ベトナム語",
    es: "Vietnamita",
    ar: "الفيتنامية",
  },
  id: {
    en: "Indonesian",
    zh: "印尼语",
    "zh-Hant": "印尼語",
    ja: "インドネシア語",
    es: "Indonesio",
    ar: "الإندونيسية",
  },
};

const GENRE_TRANSLATIONS: Record<GenreKey, Record<Locale, string>> = {
  drama: {
    en: "Drama",
    zh: "剧情",
    "zh-Hant": "劇情",
    ja: "ドラマ",
    es: "Drama",
    ar: "دراما",
  },
  comedy: {
    en: "Comedy",
    zh: "喜剧",
    "zh-Hant": "喜劇",
    ja: "コメディ",
    es: "Comedia",
    ar: "كوميديا",
  },
  thriller: {
    en: "Thriller&Mystery",
    zh: "悬疑惊悚",
    "zh-Hant": "懸疑驚悚",
    ja: "スリラー＆ミステリー",
    es: "Thriller y Misterio",
    ar: "إثارة وغموض",
  },
  action: {
    en: "Action",
    zh: "动作",
    "zh-Hant": "動作",
    ja: "アクション",
    es: "Acción",
    ar: "أكشن",
  },
  animation: {
    en: "Animation",
    zh: "动画",
    "zh-Hant": "動畫",
    ja: "アニメーション",
    es: "Animación",
    ar: "أنميشن",
  },
  crime: {
    en: "Crime",
    zh: "犯罪",
    "zh-Hant": "犯罪",
    ja: "犯罪",
    es: "Crimen",
    ar: "جريمة",
  },
  documentary: {
    en: "Documentary",
    zh: "纪录片",
    "zh-Hant": "紀錄片",
    ja: "ドキュメンタリー",
    es: "Documental",
    ar: "وثائقي",
  },
  kids: {
    en: "Kids&Family",
    zh: "合家欢",
    "zh-Hant": "闔家歡",
    ja: "キッズ＆ファミリー",
    es: "Niños y Familia",
    ar: "أطفال وعائلة",
  },
  scifi: {
    en: "Sci-Fi",
    zh: "科幻",
    "zh-Hant": "科幻",
    ja: "SF",
    es: "Ciencia Ficción",
    ar: "خيال علمي",
  },
  romance: {
    en: "Romance",
    zh: "爱情",
    "zh-Hant": "愛情",
    ja: "ロマンス",
    es: "Romance",
    ar: "رومانسية",
  },
  war: {
    en: "War",
    zh: "战争",
    "zh-Hant": "戰爭",
    ja: "戦争",
    es: "Bélico",
    ar: "حرب",
  },
};

const GENRE_ITEMS: { id: string; key: GenreKey; imageName: string }[] = [
  { id: "18", key: "drama", imageName: "Drama-1.png" },
  { id: "35", key: "comedy", imageName: "Comedy-1.png" },
  { id: "9648,53", key: "thriller", imageName: "Thriller-1.png" },
  { id: "28", key: "action", imageName: "Action-1.png" },
  { id: "878", key: "scifi", imageName: "Sci-fi-1.png" },
  { id: "16", key: "animation", imageName: "Animation-1.png" },
  { id: "80", key: "crime", imageName: "Crime-1.png" },
  { id: "10749", key: "romance", imageName: "Romance-1.png" },
  { id: "10752", key: "war", imageName: "War-1.png" },
  { id: "99", key: "documentary", imageName: "Documentary-1.png" },
  { id: "10751", key: "kids", imageName: "Kid-1.png" },
];

function createTmdbListRoute(
  title: string,
  params: TmdbListRoute["params"]
): TmdbListRoute {
  return {
    type: "tmdb-list",
    title,
    params,
  };
}

function resolveLocale(language: string): Locale {
  const normalized = language.toLowerCase();
  if (
    normalized.startsWith("zh-hant") ||
    normalized.includes("tw") ||
    normalized.includes("hk")
  ) {
    return "zh-Hant";
  }
  if (normalized.startsWith("zh")) return "zh";
  if (normalized.startsWith("ja")) return "ja";
  if (normalized.startsWith("es")) return "es";
  if (normalized.startsWith("ar")) return "ar";
  return "en";
}

function resolveRequestLocale(c: Context): Locale | null {
  const language = c.req.query("language");
  return language ? resolveLocale(language) : null;
}

function localizeDiscoverTVByLanguage(
  payload: DiscoverTVByLanguageResponse,
  locale: Locale
): DiscoverTVByLanguageResponse {
  const data = (payload.data ?? []).map((item) => {
    const title =
      LANGUAGE_NAME_TRANSLATIONS[item.language]?.[locale] ||
      item.languageName ||
      item.language;
    return {
      ...item,
      languageName: title,
      title,
      route: createTmdbListRoute(title, {
        category: "discover",
        type: "movie",
        language: item.language,
      }),
    };
  });

  return {
    ...payload,
    count: payload.count ?? data.length,
    data,
  };
}

function createDiscoverGenres(locale: Locale): DiscoverGenresResponse {
  const data = GENRE_ITEMS.map((item) => {
    const title = GENRE_TRANSLATIONS[item.key][locale];
    return {
      id: item.id,
      title,
      imageUri: `https://${R2_CUSTOM_DOMAIN}/genres/${item.imageName}`,
      route: createTmdbListRoute(title, {
        category: "discover",
        type: "movie",
        genre: item.id,
      }),
    };
  });

  return {
    type: "discover_genres",
    count: data.length,
    data,
  };
}

app.post("/crawl/movies", async (c) => {
  const results = await crawlDoubanMovies();
  return c.json({ success: true, count: results.length });
});

app.post("/crawl/tv", async (c) => {
  const results = await crawlDoubanTVSeries();
  return c.json({ success: true, count: results.length });
});

app.post("/crawl/douban/korean-tv", async (c) => {
  const results = await crawlDoubanKoreanTVSeries();
  return c.json({ success: true, count: results.length });
});

app.post("/crawl/douban/japanese-tv", async (c) => {
  const results = await crawlDoubanJapaneseTVSeries();
  return c.json({ success: true, count: results.length });
});

app.post("/crawl/hami/taiwanese-tv", async (c) => {
  const results = await crawlHamiTaiwaneseTVSeries();
  return c.json({ success: true, count: results.length });
});

app.post("/crawl/douban/animation", async (c) => {
  const results = await crawlDoubanAnimation();
  return c.json({ success: true, count: results.length });
});

app.post("/crawl/douban/hot-variety-shows", async (c) => {
  const results = await crawlDoubanHotVarietyShows();
  return c.json({ success: true, count: results.length });
});

app.post("/crawl/bangumi/animation", async (c) => {
  const results = await crawlBangumiAnimation();
  return c.json({ success: true, count: results.length });
});

app.get("/cron/crawl-all", async (c) => {
  const startTime = Date.now();

  try {
    console.log("🕐 Scheduled crawl started at", new Date().toISOString());

    // Run all crawlers in parallel for better performance
    const [
      movies,
      tvSeries,
      koreanTVSeries,
      japaneseTVSeries,
      taiwaneseTVSeries,
      doubanAnimation,
      hotVarietyShows,
      bangumiAnimation,
    ] = await Promise.all([
      crawlDoubanMovies(),
      crawlDoubanTVSeries(),
      crawlDoubanKoreanTVSeries(),
      crawlDoubanJapaneseTVSeries(),
      crawlHamiTaiwaneseTVSeries(),
      crawlDoubanAnimation(),
      crawlDoubanHotVarietyShows(),
      crawlBangumiAnimation(),
    ]);

    const duration = Date.now() - startTime;

    return c.json({
      success: true,
      movies: { count: movies.length },
      tvSeries: { count: tvSeries.length },
      koreanTVSeries: { count: koreanTVSeries.length },
      japaneseTVSeries: { count: japaneseTVSeries.length },
      taiwaneseTVSeries: { count: taiwaneseTVSeries.length },
      doubanAnimation: { count: doubanAnimation.length },
      hotVarietyShows: { count: hotVarietyShows.length },
      bangumiAnimation: { count: bangumiAnimation.length },
      duration: `${Math.round(duration / 1000)}s`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Scheduled crawl failed:", error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

app.get("/popular/douban/movies", (c) =>
  serveStaticR2Json(c, "douban-movies.json")
);

app.get("/popular/douban/tv", (c) => serveStaticR2Json(c, "douban-tv.json"));

app.get("/popular/douban/korean-tv", (c) =>
  serveStaticR2Json(c, "douban-korean-tv.json")
);

app.get("/popular/douban/japanese-tv", (c) =>
  serveStaticR2Json(c, "douban-japanese-tv.json")
);

app.get("/popular/hami/taiwanese-tv", (c) =>
  serveStaticR2Json(c, "hami-taiwanese-tv.json")
);

app.get("/popular/douban/animation", (c) =>
  serveStaticR2Json(c, "douban-animation.json")
);

app.get("/popular/douban/hot-variety-shows", (c) =>
  serveStaticR2Json(c, "douban-hot-variety-shows.json")
);

app.get("/popular/bangumi/animation", (c) =>
  serveStaticR2Json(c, "bangumi-animation.json")
);

app.get("/discover/genres", (c) => {
  const locale = resolveRequestLocale(c) ?? "en";
  const body = createDiscoverGenres(locale);
  return c.json(body, 200, {
    "Cache-Control": STATIC_JSON_CACHE_CONTROL,
  });
});

app.get("/discover/tv-by-language", async (c) => {
  const locale = resolveRequestLocale(c);
  const key = "discover-tv-by-language.json";
  if (!locale) {
    return serveStaticR2Json(c, key);
  }

  const result = await readStaticR2Json(c, key);
  if (!result.ok) return result.response;
  const payload = result.data as DiscoverTVByLanguageResponse;
  return c.json(localizeDiscoverTVByLanguage(payload, locale), 200, {
    "Cache-Control": STATIC_JSON_CACHE_CONTROL,
  });
});

app.get("/discover/tv-by-network", async (c) => {
  const result = await readStaticR2Json(c, "discover-tv-by-network.json");
  if (!result.ok) return result.response;
  const payload = result.data as DiscoverTVByNetworkResponse;

  const data = (payload.data ?? []).map((item) => {
    const title = item.networkName || String(item.networkId);
    return {
      ...item,
      title,
      route: createTmdbListRoute(title, {
        category: "discover",
        type: "tv",
        network: String(item.networkId),
        networkName: title,
      }),
    };
  });

  return c.json(
    {
      ...payload,
      count: payload.count ?? data.length,
      data,
    },
    200,
    { "Cache-Control": STATIC_JSON_CACHE_CONTROL }
  );
});

export default app;
