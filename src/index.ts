import { Hono } from "hono";
import tmdbApp from "./tmdb/index.js";
import crawlerApp from "./crawler/index.js";
import dataApp from "./data/index.js";

const app = new Hono();

const welcomeStrings = [
  "Hello Hono!",
  "To learn more about Hono on Vercel, visit https://vercel.com/docs/frameworks/backend/hono",
];

// Root route
app.get("/", (c) => {
  return c.text(welcomeStrings.join("\n\n"));
});

// Mount TMDB routes
app.route("/tmdb", tmdbApp);

// Mount Crawler routes
app.route("/crawler", crawlerApp);

// Mount Data routes for accessing JSON files
app.route("/data", dataApp);

export default app;
