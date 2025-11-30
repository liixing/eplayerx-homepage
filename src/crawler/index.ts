import { Hono } from "hono";
import {
  crawlDoubanMovies,
  crawlDoubanTVSeries,
  crawlBilibiliAnime,
  crawlBilibiliGuochuang,
} from "./crawlers.js";
import {
  loadMovies,
  loadTVSeries,
  loadBilibiliAnime,
  loadBilibiliGuochuang,
  getMoviesLastUpdate,
  getTVSeriesLastUpdate,
  getBilibiliAnimeLastUpdate,
  getBilibiliGuochuangLastUpdate,
} from "./service.js";

const app = new Hono();

app.post("/crawl/movies", async (c) => {
  const results = await crawlDoubanMovies();
  return c.json({ success: true, count: results.length });
});

app.post("/crawl/tv", async (c) => {
  const results = await crawlDoubanTVSeries();
  return c.json({ success: true, count: results.length });
});

app.post("/crawl/bilibili", async (c) => {
  const results = await crawlBilibiliAnime();
  return c.json({ success: true, count: results.length });
});

app.post("/crawl/bilibili/guochuang", async (c) => {
  const results = await crawlBilibiliGuochuang();
  return c.json({ success: true, count: results.length });
});

app.get("/cron/crawl-all", async (c) => {
  const startTime = Date.now();

  try {
    console.log("🕐 Scheduled crawl started at", new Date().toISOString());

    // Run all crawlers in parallel for better performance
    const [movies, tvSeries, anime, guochuang] = await Promise.all([
      crawlDoubanMovies(),
      crawlDoubanTVSeries(),
      crawlBilibiliAnime(),
      crawlBilibiliGuochuang(),
    ]);

    const duration = Date.now() - startTime;

    return c.json({
      success: true,
      movies: { count: movies.length },
      tvSeries: { count: tvSeries.length },
      anime: { count: anime.length },
      guochuang: { count: guochuang.length },
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

app.get("/popular/douban/movies", async (c) => {
  const movies = await loadMovies();
  const lastUpdate = await getMoviesLastUpdate();
  return c.json({
    success: true,
    platform: "douban",
    type: "movie",
    count: movies.length,
    lastUpdated: lastUpdate,
    data: movies,
  });
});

app.get("/popular/douban/tv", async (c) => {
  const tvSeries = await loadTVSeries();
  const lastUpdate = await getTVSeriesLastUpdate();
  return c.json({
    success: true,
    platform: "douban",
    type: "tv_series",
    count: tvSeries.length,
    lastUpdated: lastUpdate,
    data: tvSeries,
  });
});

app.get("/popular/bilibili/anime", async (c) => {
  const anime = await loadBilibiliAnime();
  const lastUpdate = await getBilibiliAnimeLastUpdate();
  return c.json({
    success: true,
    platform: "bilibili",
    type: "anime",
    count: anime.length,
    lastUpdated: lastUpdate,
    data: anime,
  });
});

app.get("/popular/bilibili/guochuang", async (c) => {
  const guochuang = await loadBilibiliGuochuang();
  const lastUpdate = await getBilibiliGuochuangLastUpdate();
  return c.json({
    success: true,
    platform: "bilibili",
    type: "guochuang",
    count: guochuang.length,
    lastUpdated: lastUpdate,
    data: guochuang,
  });
});

export default app;
