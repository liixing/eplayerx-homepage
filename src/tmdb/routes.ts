import { Hono } from "hono";
import { tmdb } from "./client.js";

const tmdbApp = new Hono();

// Movie sort_by type and validation
type MovieSortBy =
  | "original_title.asc"
  | "original_title.desc"
  | "popularity.asc"
  | "popularity.desc"
  | "revenue.asc"
  | "revenue.desc"
  | "primary_release_date.asc"
  | "title.asc"
  | "title.desc"
  | "primary_release_date.desc"
  | "vote_average.asc"
  | "vote_average.desc"
  | "vote_count.asc"
  | "vote_count.desc";

const VALID_MOVIE_SORT_BY_VALUES: readonly MovieSortBy[] = [
  "original_title.asc",
  "original_title.desc",
  "popularity.asc",
  "popularity.desc",
  "revenue.asc",
  "revenue.desc",
  "primary_release_date.asc",
  "title.asc",
  "title.desc",
  "primary_release_date.desc",
  "vote_average.asc",
  "vote_average.desc",
  "vote_count.asc",
  "vote_count.desc",
] as const;

function isValidMovieSortBy(value: string | undefined): value is MovieSortBy {
  return (
    value !== undefined &&
    VALID_MOVIE_SORT_BY_VALUES.includes(value as MovieSortBy)
  );
}

// TV sort_by type and validation
type TvSortBy =
  | "popularity.asc"
  | "popularity.desc"
  | "vote_average.asc"
  | "vote_average.desc"
  | "vote_count.asc"
  | "vote_count.desc"
  | "first_air_date.asc"
  | "first_air_date.desc"
  | "name.asc"
  | "name.desc"
  | "original_name.asc"
  | "original_name.desc";

const VALID_TV_SORT_BY_VALUES: readonly TvSortBy[] = [
  "popularity.asc",
  "popularity.desc",
  "vote_average.asc",
  "vote_average.desc",
  "vote_count.asc",
  "vote_count.desc",
  "first_air_date.asc",
  "first_air_date.desc",
  "name.asc",
  "name.desc",
  "original_name.asc",
  "original_name.desc",
] as const;

function isValidTvSortBy(value: string | undefined): value is TvSortBy {
  return (
    value !== undefined && VALID_TV_SORT_BY_VALUES.includes(value as TvSortBy)
  );
}

tmdbApp.get("/search/keyword", async (c) => {
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

tmdbApp.get("/genre/tv/list", async (c) => {
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

tmdbApp.get("/genre/movie/list", async (c) => {
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

tmdbApp.get("/movie/details", async (c) => {
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

tmdbApp.get("/movie/images", async (c) => {
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

tmdbApp.get("/movie/external_ids", async (c) => {
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

tmdbApp.get("/movie/credits", async (c) => {
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

tmdbApp.get("/movie/similar", async (c) => {
  const id = c.req.query("id") || "";
  const language = c.req.query("language") || "en";
  const result = await tmdb.GET(`/3/movie/${Number(id)}/recommendations`, {
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

tmdbApp.get("/movie/videos", async (c) => {
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

tmdbApp.get("/movie/popular", async (c) => {
  const language = c.req.query("language") || "en";
  const page = Number.parseInt(c.req.query("page") || "1");
  const result = await tmdb.GET("/3/movie/popular", {
    params: {
      query: {
        language,
        page,
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }

  return c.json(result.data);
});

tmdbApp.get("/movie/top_rated", async (c) => {
  const language = c.req.query("language") || "en";
  const page = Number.parseInt(c.req.query("page") || "1");
  const result = await tmdb.GET("/3/movie/top_rated", {
    params: {
      query: {
        language,
        page,
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data);
});

tmdbApp.get("/movie/upcoming", async (c) => {
  const language = c.req.query("language") || "en";
  const region = c.req.query("region") || "US";
  const result = await tmdb.GET("/3/movie/upcoming", {
    params: {
      query: {
        language,
        region,
      },
    },
  });

  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data);
});

tmdbApp.get("/tv/external_ids", async (c) => {
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

tmdbApp.get("/tv/details", async (c) => {
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

tmdbApp.get("/tv/images", async (c) => {
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

tmdbApp.get("/tv/season/details", async (c) => {
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

tmdbApp.get("/tv/credits", async (c) => {
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

tmdbApp.get("/tv/similar", async (c) => {
  const id = c.req.query("id") || "";
  const language = c.req.query("language") || "en";
  const result = await tmdb.GET(`/3/tv/${Number(id)}/recommendations`, {
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

tmdbApp.get("/tv/videos", async (c) => {
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

tmdbApp.get("/tv/popular", async (c) => {
  const language = c.req.query("language") || "en";
  const page = Number.parseInt(c.req.query("page") || "1");
  const result = await tmdb.GET("/3/tv/popular", {
    params: {
      query: {
        language,
        page,
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data);
});

tmdbApp.get("/tv/top_rated", async (c) => {
  const language = c.req.query("language") || "en";
  const page = Number.parseInt(c.req.query("page") || "1");
  const result = await tmdb.GET("/3/tv/top_rated", {
    params: {
      query: {
        language,
        page,
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data);
});

tmdbApp.get("/tv/on_the_air", async (c) => {
  const language = c.req.query("language") || "en";
  const timezone = c.req.query("timezone") || "America/New_York";
  const result = await tmdb.GET("/3/tv/on_the_air", {
    params: {
      query: {
        language,
        timezone,
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data);
});

tmdbApp.get("/trending/all", async (c) => {
  const language = c.req.query("language") || "en";
  const timeWindow: "day" | "week" =
    (c.req.query("timeWindow") as "day" | "week") || "day";
  const result = await tmdb.GET(`/3/trending/all/${timeWindow}`, {
    params: {
      query: {
        language,
      },
      path: {
        time_window: timeWindow,
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data);
});

tmdbApp.get("/trending/movie", async (c) => {
  const language = c.req.query("language") || "en";
  const timeWindow: "day" | "week" =
    (c.req.query("timeWindow") as "day" | "week") || "day";
  const page = Number.parseInt(c.req.query("page") || "1");
  const result = await tmdb.GET(`/3/trending/movie/${timeWindow}`, {
    params: {
      query: {
        language,
        page,
      },
      path: {
        time_window: timeWindow,
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data);
});

tmdbApp.get("/trending/tv", async (c) => {
  const language = c.req.query("language") || "en";
  const timeWindow: "day" | "week" =
    (c.req.query("timeWindow") as "day" | "week") || "day";
  const page = Number.parseInt(c.req.query("page") || "1");
  const result = await tmdb.GET(`/3/trending/tv/${timeWindow}`, {
    params: {
      query: {
        language,
        page,
      },
      path: {
        time_window: timeWindow,
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data);
});

tmdbApp.get("/discover/movie", async (c) => {
  const language = c.req.query("language") || "en";
  const page = Number.parseInt(c.req.query("page") || "1");
  const with_genres = c.req.query("with_genres");
  const without_genres = c.req.query("without_genres");
  const with_networks = c.req.query("with_networks");
  const with_original_language = c.req.query("with_original_language");
  const sortByQuery = c.req.query("sort_by");

  if (sortByQuery && !isValidMovieSortBy(sortByQuery)) {
    return c.json(
      {
        error: `Invalid sort_by value. Allowed values: ${VALID_MOVIE_SORT_BY_VALUES.join(
          ", "
        )}`,
      },
      400
    );
  }

  const sort_by = sortByQuery as MovieSortBy | undefined;
  const result = await tmdb.GET("/3/discover/movie", {
    params: {
      query: {
        language,
        page,
        sort_by,
        with_genres,
        without_genres,
        with_networks,
        with_original_language,
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data);
});

tmdbApp.get("/discover/tv", async (c) => {
  const language = c.req.query("language") || "en";
  const page = Number.parseInt(c.req.query("page") || "1");
  const with_genres = c.req.query("with_genres");
  const without_genres = c.req.query("without_genres");
  const with_networks_query = c.req.query("with_networks");
  const with_networks = with_networks_query
    ? Number.parseInt(with_networks_query)
    : undefined;
  const with_original_language = c.req.query("with_original_language") || "";
  const sortByQuery = c.req.query("sort_by");

  if (sortByQuery && !isValidTvSortBy(sortByQuery)) {
    return c.json(
      {
        error: `Invalid sort_by value. Allowed values: ${VALID_TV_SORT_BY_VALUES.join(
          ", "
        )}`,
      },
      400
    );
  }

  const sort_by = sortByQuery as TvSortBy | undefined;
  const result = await tmdb.GET("/3/discover/tv", {
    params: {
      query: {
        language,
        page,
        sort_by,
        with_genres,
        without_genres,
        with_networks,
        with_original_language,
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data);
});

export default tmdbApp;
