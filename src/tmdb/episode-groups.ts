import { Hono, type Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { tmdb } from "./client.js";

const routes = new Hono();

function upstreamError(c: Context, response: Response) {
  const retry = response.headers.get("Retry-After");
  if (retry) c.header("Retry-After", retry);
  c.header("Cache-Control", "no-store");
  return c.json({ error: `TMDB HTTP ${response.status}` }, response.status as ContentfulStatusCode);
}

function seriesID(value: string | undefined): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

routes.get("/tv/episode_groups", async c => {
  const id = seriesID(c.req.query("id"));
  if (id === null) return c.json({ error: "Invalid series ID" }, 400);
  const result = await tmdb.GET(`/3/tv/${id}/episode_groups`, { params: { path: { series_id: id } } });
  if (result.response.status !== 200) return upstreamError(c, result.response);
  return c.json(result.data);
});

routes.get("/tv/episode_group", async c => {
  const id = c.req.query("id");
  const series = seriesID(c.req.query("seriesID"));
  if (!id || !/^[a-f\d]{24}$/.test(id) || series === null) return c.json({ error: "Invalid episode group or series ID" }, 400);
  const language = c.req.query("language") || "en-US";
  if (!/^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(language)) return c.json({ error: "Invalid language" }, 400);
  // TMDB accepts language here even though its generated OpenAPI schema omits it.
  const result = await tmdb.GET(`/3/tv/episode_group/${id}`, { params: { path: { tv_episode_group_id: id }, query: { language } as never } });
  if (result.response.status !== 200) return upstreamError(c, result.response);
  const episodes = result.data?.groups?.flatMap(group => group.episodes ?? []) ?? [];
  if (result.data?.id !== id || !episodes.length || episodes.some(episode => episode.show_id !== series)) {
    c.header("Cache-Control", "no-store");
    return c.json({ error: "Episode group does not belong to this series" }, 422);
  }
  return c.json(result.data);
});

export default routes;
