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
  return c.json(result.data?.results);
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
  const language = c.req.query("language") || "en";
  const result = await tmdb.GET("/3/genre/movie/list", {
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

app.get("/tmdb/movie/details", async (c) => {
  const id = c.req.query("id") || "";
  const language = c.req.query("language") || "en";
  const result = await tmdb.GET(`/3/movie/${Number(id)}`, {
    params: {
      query: {
        language,
      },
      path: {
        movie_id: Number(id),
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data);
});

app.get("/tmdb/movie/images", async (c) => {
  const id = c.req.query("id") || "";
  const result = await tmdb.GET(`/3/movie/${Number(id)}/images`, {
    params: {
      path: {
        movie_id: Number(id),
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data);
});

app.get("/tmdb/movie/external_ids", async (c) => {
  const id = c.req.query("id") || "";
  const result = await tmdb.GET(`/3/movie/${Number(id)}/external_ids`, {
    params: {
      path: {
        movie_id: Number(id),
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data);
});

app.get("/tmdb/movie/credits", async (c) => {
  const id = c.req.query("id") || "";
  const language = c.req.query("language") || "en";
  const result = await tmdb.GET(`/3/movie/${Number(id)}/credits`, {
    params: {
      query: {
        language,
      },
      path: {
        movie_id: Number(id),
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data);
});

app.get("/tmdb/movie/similar", async (c) => {
  const id = c.req.query("id") || "";
  const language = c.req.query("language") || "en";
  const result = await tmdb.GET(`/3/movie/${Number(id)}/similar`, {
    params: {
      query: {
        language,
      },
      path: {
        movie_id: Number(id),
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data);
});

app.get("/tmdb/movie/videos", async (c) => {
  const id = c.req.query("id") || "";
  const language = c.req.query("language") || "en";
  const result = await tmdb.GET(`/3/movie/${Number(id)}/videos`, {
    params: {
      query: {
        language,
      },
      path: {
        movie_id: Number(id),
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data);
});

app.get("/tmdb/tv/external_ids", async (c) => {
  const id = c.req.query("id") || "";
  const result = await tmdb.GET(`/3/tv/${Number(id)}/external_ids`, {
    params: {
      path: {
        series_id: Number(id),
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data);
});

app.get("/tmdb/tv/details", async (c) => {
  const id = c.req.query("id") || "";
  const language = c.req.query("language") || "en";
  const result = await tmdb.GET(`/3/tv/${Number(id)}`, {
    params: {
      query: {
        language,
      },
      path: {
        series_id: Number(id),
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data);
});

app.get("/tmdb/tv/images", async (c) => {
  const id = c.req.query("id") || "";
  const result = await tmdb.GET(`/3/tv/${Number(id)}/images`, {
    params: {
      path: {
        series_id: Number(id),
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data);
});

app.get("/tmdb/tv/season/details", async (c) => {
  const id = c.req.query("id") || "";
  const seasonNumber = c.req.query("seasonNumber") || "";
  const language = c.req.query("language") || "en";
  const result = await tmdb.GET(
    `/3/tv/${Number(id)}/season/${Number(seasonNumber)}`,
    {
      params: {
        query: {
          language,
        },
        path: {
          series_id: Number(id),
          season_number: Number(seasonNumber),
        },
      },
    }
  );
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data);
});

app.get("/tmdb/tv/credits", async (c) => {
  const id = c.req.query("id") || "";
  const language = c.req.query("language") || "en";
  const result = await tmdb.GET(`/3/tv/${Number(id)}/credits`, {
    params: {
      query: {
        language,
      },
      path: {
        series_id: Number(id),
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data);
});

app.get("/tmdb/tv/similar", async (c) => {
  const id = c.req.query("id") || "";
  const language = c.req.query("language") || "en";
  const result = await tmdb.GET(`/3/tv/${Number(id)}/similar`, {
    params: {
      query: {
        language,
      },
      path: {
        series_id: id,
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data);
});

app.get("/tmdb/tv/videos", async (c) => {
  const id = c.req.query("id") || "";
  const language = c.req.query("language") || "en";
  const result = await tmdb.GET(`/3/tv/${Number(id)}/videos`, {
    params: {
      query: {
        language,
      },
      path: {
        series_id: Number(id),
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data);
});

app.get("/tmdb/tv/external_ids", async (c) => {
  const id = c.req.query("id") || "";
  const result = await tmdb.GET(`/3/tv/${Number(id)}/external_ids`, {
    params: {
      path: {
        series_id: Number(id),
      },
    },
  });

  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data);
});

export default app;
