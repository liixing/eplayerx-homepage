import assert from "node:assert/strict";
import { test } from "node:test";
import routes from "./episode-groups.js";

test("episode groups validate IDs, series ownership and upstream failures", async () => {
  process.env.TMDB_API_TOKEN = "test-token";
  const originalFetch = globalThis.fetch;
  const id = "5acf93e60e0a26346d0000ce";
  const calls: URL[] = [];
  let status = 200;
  globalThis.fetch = async input => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    calls.push(url);
    if (status !== 200) return Response.json({}, { status, headers: { "Retry-After": "7" } });
    return Response.json(url.pathname.endsWith("episode_groups")
      ? { id: 123, results: [{ id, name: "DVD", group_count: 1, episode_count: 1 }] }
      : { id, name: "DVD", groups: [{ order: 1, episodes: [{ id: 7, show_id: 123, order: 0, season_number: 2, episode_number: 3,
          name: url.searchParams.get("language") === "zh-CN" ? "中文集名" : "English title",
          overview: url.searchParams.get("language") === "zh-CN" ? "中文简介" : "English overview" }] }] });
  };
  try {
    for (const path of ["/tv/episode_groups?id=0", "/tv/episode_groups?id=1.5", "/tv/episode_group?id=../bad&seriesID=123", `/tv/episode_group?id=${id}`, `/tv/episode_group?id=${id}&seriesID=123&language=invalid!`]) {
      assert.equal((await routes.request(path)).status, 400);
    }
    assert.equal(calls.length, 0);
    const list = await routes.request("/tv/episode_groups?id=123");
    assert.equal(list.status, 200); assert.equal((await list.json() as any).results[0].id, id);
    const details = await routes.request(`/tv/episode_group?id=${id}&seriesID=123`);
    assert.equal(details.status, 200); assert.equal((await details.json() as any).groups[0].episodes[0].season_number, 2);
    assert.equal((await routes.request(`/tv/episode_group?id=${id}&seriesID=456`)).status, 422);
    status = 429;
    const limited = await routes.request("/tv/episode_groups?id=123");
    assert.equal(limited.status, 429); assert.equal(limited.headers.get("Retry-After"), "7"); assert.equal(limited.headers.get("Cache-Control"), "no-store");
    assert.equal(calls[0].pathname, "/3/tv/123/episode_groups");
    assert.equal(calls[1].pathname, `/3/tv/episode_group/${id}`);
    assert.equal(calls[1].searchParams.get("language"), "en-US");
    status = 200;
    const localized = await routes.request(`/tv/episode_group?id=${id}&seriesID=123&language=zh-CN`);
    const episode = (await localized.json() as any).groups[0].episodes[0];
    assert.equal(episode.name, "中文集名"); assert.equal(episode.overview, "中文简介");
    assert.equal(calls.at(-1)?.searchParams.get("language"), "zh-CN");
  } finally { globalThis.fetch = originalFetch; }
});
