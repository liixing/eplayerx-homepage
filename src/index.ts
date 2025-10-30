import { Hono } from "hono";
import createClient from "openapi-fetch";
import { paths } from "../lib/tmdb-api.js";

const app = new Hono();

if (!process.env.TMDB_API_TOKEN) {
  throw new Error("TMDB_API_TOKEN is not set");
}

const tmdb = createClient<paths>({
  baseUrl: process.env.PUBLIC_TMDB_API_BASE_URL || "https://api.themoviedb.org",
  headers: {
    accept: "application/json",
    Authorization: `Bearer ${process.env.TMDB_API_TOKEN}`,
  },
});

const welcomeStrings = [
  "Hello Hono!",
  "To learn more about Hono on Vercel, visit https://vercel.com/docs/frameworks/backend/hono",
];

app.get("/", (c) => {
  return c.text(welcomeStrings.join("\n\n"));
});

app.get("/tmdb/search/keyword", async (c) => {
  const query = c.req.query("query") || "";
  const page = Number.parseInt(c.req.query("page") || "1");
  const language = c.req.query("language") || "en-US";
  const result = await tmdb.GET("/3/search/multi", {
    params: {
      query: {
        query,
        page,
        language,
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data?.results || []);
});

app.get("/tmdb/genre/tv/list", async (c) => {
  const language = c.req.query("language") || "en";
  const result = await tmdb.GET("/3/genre/tv/list", {
    params: {
      query: {
        language,
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data?.genres || []);
});

app.get("/tmdb/genre/movie/list", async (c) => {
  const result = await tmdb.GET("/3/genre/movie/list", {
    params: {
      query: {
        language: "en-US",
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data?.genres || []);
});

export default app;
