import { Hono } from "hono";
import { crawlDoubanMovies, crawlDoubanTVSeries } from "./crawlers.js";
import {
  loadMovies,
  loadTVSeries,
  getMoviesLastUpdate,
  getTVSeriesLastUpdate,
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

app.get("/cron/crawl-all", async (c) => {
  const startTime = Date.now();

  try {
    console.log("🕐 Scheduled crawl started at", new Date().toISOString());

    // Run both crawlers in parallel for better performance
    const [movies, tvSeries] = await Promise.all([
      crawlDoubanMovies(),
      crawlDoubanTVSeries(),
    ]);

    const duration = Date.now() - startTime;

    return c.json({
      success: true,
      movies: { count: movies.length },
      tvSeries: { count: tvSeries.length },
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

export default app;
