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

const app = new Hono();

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
  | "kids";

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
};

const GENRE_ITEMS: { id: string; key: GenreKey; imageName: string }[] = [
  { id: "18", key: "drama", imageName: "Drama.png" },
  { id: "35", key: "comedy", imageName: "Comedy.png" },
  { id: "9648,53", key: "thriller", imageName: "Thriller.png" },
  { id: "28", key: "action", imageName: "Action.png" },
  { id: "16", key: "animation", imageName: "Animation.png" },
  { id: "80", key: "crime", imageName: "Crime.png" },
  { id: "99", key: "documentary", imageName: "Documentary.png" },
  { id: "10751", key: "kids", imageName: "Kid.png" },
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

app.get("/popular/douban/movies", async (_c) => {
  const url = `https://${R2_CUSTOM_DOMAIN}/douban-movies.json`;
  const response = await fetch(url);
  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("Content-Type") || "application/json",
    },
  });
});

app.get("/popular/douban/tv", async (_c) => {
  const url = `https://${R2_CUSTOM_DOMAIN}/douban-tv.json`;
  const response = await fetch(url);
  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("Content-Type") || "application/json",
    },
  });
});

app.get("/popular/douban/korean-tv", async (_c) => {
  const url = `https://${R2_CUSTOM_DOMAIN}/douban-korean-tv.json`;
  const response = await fetch(url);
  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("Content-Type") || "application/json",
    },
  });
});

app.get("/popular/douban/japanese-tv", async (_c) => {
  const url = `https://${R2_CUSTOM_DOMAIN}/douban-japanese-tv.json`;
  const response = await fetch(url);
  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("Content-Type") || "application/json",
    },
  });
});

app.get("/popular/hami/taiwanese-tv", async (_c) => {
  const url = `https://${R2_CUSTOM_DOMAIN}/hami-taiwanese-tv.json`;
  const response = await fetch(url);
  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("Content-Type") || "application/json",
    },
  });
});

app.get("/popular/douban/animation", async (_c) => {
  const url = `https://${R2_CUSTOM_DOMAIN}/douban-animation.json`;
  const response = await fetch(url);
  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("Content-Type") || "application/json",
    },
  });
});

app.get("/popular/douban/hot-variety-shows", async (_c) => {
  const url = `https://${R2_CUSTOM_DOMAIN}/douban-hot-variety-shows.json`;
  const response = await fetch(url);
  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("Content-Type") || "application/json",
    },
  });
});

app.get("/popular/bangumi/animation", async (_c) => {
  const url = `https://${R2_CUSTOM_DOMAIN}/bangumi-animation.json`;
  const response = await fetch(url);
  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("Content-Type") || "application/json",
    },
  });
});

app.get("/discover/genres", (c) => {
  const locale = resolveRequestLocale(c) ?? "en";
  return c.json(createDiscoverGenres(locale));
});

app.get("/discover/tv-by-language", async (c) => {
  const locale = resolveRequestLocale(c);
  const url = `https://${R2_CUSTOM_DOMAIN}/discover-tv-by-language.json`;
  const response = await fetch(url);
  if (!locale) {
    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("Content-Type") || "application/json",
      },
    });
  }
  if (!response.ok) {
    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("Content-Type") || "application/json",
      },
    });
  }

  const payload = (await response.json()) as DiscoverTVByLanguageResponse;
  return c.json(localizeDiscoverTVByLanguage(payload, locale));
});

app.get("/discover/tv-by-network", async (c) => {
  const url = `https://${R2_CUSTOM_DOMAIN}/discover-tv-by-network.json`;
  const response = await fetch(url);
  if (!response.ok) {
    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("Content-Type") || "application/json",
      },
    });
  }

  const payload = (await response.json()) as DiscoverTVByNetworkResponse;
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

  return c.json({
    ...payload,
    count: payload.count ?? data.length,
    data,
  });
});

export default app;
