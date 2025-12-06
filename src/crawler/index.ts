import { Hono } from "hono";
import {
  crawlDoubanAnimation,
  crawlDoubanMovies,
  crawlDoubanTVSeries,
} from "./crawlers.js";
import {
  getDoubanAnimationLastUpdate,
  getMoviesLastUpdate,
  getTVSeriesLastUpdate,
  loadDoubanAnimation,
  loadMovies,
  loadTVSeries,
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

app.post("/crawl/douban/animation", async (c) => {
  const results = await crawlDoubanAnimation();
  return c.json({ success: true, count: results.length });
});

app.get("/cron/crawl-all", async (c) => {
  const startTime = Date.now();

  try {
    console.log("🕐 Scheduled crawl started at", new Date().toISOString());

    // Run all crawlers in parallel for better performance
    const [movies, tvSeries, doubanAnimation] = await Promise.all([
      crawlDoubanMovies(),
      crawlDoubanTVSeries(),
      crawlDoubanAnimation(),
    ]);

    const duration = Date.now() - startTime;

    return c.json({
      success: true,
      movies: { count: movies.length },
      tvSeries: { count: tvSeries.length },
      doubanAnimation: { count: doubanAnimation.length },
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
    type: "tv",
    count: tvSeries.length,
    lastUpdated: lastUpdate,
    data: tvSeries,
  });
});

app.get("/popular/douban/animation", async (c) => {
  const animation = await loadDoubanAnimation();
  const lastUpdate = await getDoubanAnimationLastUpdate();
  return c.json({
    success: true,
    platform: "douban",
    type: "animation",
    count: animation.length,
    lastUpdated: lastUpdate,
    data: animation,
  });
});

export default app;
