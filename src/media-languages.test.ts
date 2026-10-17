import assert from "node:assert/strict";
import { test } from "node:test";
import home from "./home/index.js";
import routes from "./tmdb/routes.js";
import crawler from "./crawler/index.js";
import { Hono } from "hono";
import { localizeMediaPayload } from "./media-languages.js";

test("home keeps App-language headings and only adds explicit media preferences", async () => {
  for (const endpoint of ["/config", "/config/v2"]) {
    const base = await (await home.request(`${endpoint}?language=en-US`)).json() as any;
    const defaults = await (await home.request(`${endpoint}?language=en-US&metadataLanguage=&posterLanguage=&logoLanguage=`)).json();
    assert.deepEqual(defaults, base);
    const mixed = await (await home.request(`${endpoint}?language=en-US&metadataLanguage=zh-CN&posterLanguage=zh-TW&logoLanguage=ja-JP`)).json() as any;
    assert.deepEqual(mixed.blocks.map((b: any) => b.title), base.blocks.map((b: any) => b.title));
    const media = mixed.blocks.find((b: any) => b.id === "tmdb-popular-movies");
    assert.equal(media.source.query.language, "en-US");
    assert.equal(media.source.query.metadataLanguage, "zh-CN");
    assert.equal(media.source.query.posterLanguage, "zh-TW");
    assert.equal(media.source.query.logoLanguage, "ja-JP");
    const genres = mixed.blocks.find((b: any) => b.preset === "genres-list");
    assert.equal(genres.source.query.metadataLanguage, undefined);
  }
});

test("legacy discovery requests preserve upstream query defaults", async (t) => {
  process.env.TMDB_API_TOKEN = "test";
  const urls: URL[] = [];
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    urls.push(new URL(input instanceof Request ? input.url : String(input)));
    return Response.json({ results: [] });
  });
  await routes.request("/discover/movie?page=2");
  await routes.request("/discover/movie?page=2&language=zh-CN");
  assert.equal(urls[0].searchParams.get("language"), null);
  assert.equal(urls[1].searchParams.get("language"), "zh-CN");
});

test("TMDB text, posters and logos are independent, including original-language fallback", async (t) => {
  process.env.TMDB_API_TOKEN = "test";
  const urls: URL[] = [];
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    urls.push(url);
    if (url.pathname.includes("/discover/")) return Response.json({ results: [{ id: 42, title: "元数据标题", original_language: "ko" }] });
    return Response.json({ id: 42, title: "元数据标题", overview: "元数据简介", original_language: "ko", images: {
      posters: [{ file_path: "/tw.jpg", iso_639_1: "zh", iso_3166_1: "TW", width: 500, height: 750 }],
      logos: [{ file_path: "/ja.png", iso_639_1: "ja", width: 500, height: 100 },
        { file_path: "/ko.png", iso_639_1: "ko", width: 500, height: 100 }],
    } });
  });
  for (const [logoLanguage, path] of [["ja-JP", "/ja.png"], ["original", "/ko.png"]]) {
    const response = await routes.request(`/discover/movie?language=en-US&metadataLanguage=zh-CN&posterLanguage=zh-TW&logoLanguage=${logoLanguage}`);
    assert.equal(response.status, 200);
    const item = (await response.json() as any).results[0];
    assert.equal(item.title, "元数据标题");
    assert.equal(item.poster_path, "/tw.jpg");
    assert.equal(item.logo, path);
  }
  assert.equal(urls.length, 4, "reuse the existing one-detail-per-card enrichment budget");
  assert.ok(urls.every(url => url.searchParams.get("language") === "zh-CN"));
  assert.ok(urls.every(url => !url.searchParams.has("metadataLanguage") && !url.searchParams.has("posterLanguage")));
});

test("published snapshots stay unchanged and default requests do no TMDB work", async (t) => {
  process.env.TMDB_API_TOKEN = "test";
  const snapshot = { data: [{ tmdbId: 42, media_type: "movie", title: "已刮削标题", poster_path: "/saved.jpg", translations: { en: { title: "Saved title" } } }] };
  const saved = JSON.stringify(snapshot);
  let lookups = 0;
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname === "assets.eplayerx.com") return Response.json(snapshot);
    lookups++;
    return Response.json({ id: 42, title: "新语言标题", original_language: "ja", images: {} });
  });
  const original = await crawler.request("/popular/douban/movies?language=en-US", {}, {});
  assert.equal((await original.json() as any).data[0].title, "Saved title");
  assert.equal(lookups, 0);
  const localized = await crawler.request("/popular/douban/movies?language=en-US&metadataLanguage=zh-CN", {}, {});
  assert.equal((await localized.json() as any).data[0].title, "已刮削标题");
  assert.equal(lookups, 0, "reuse stored Chinese metadata rather than re-scraping");
  const japanese = await crawler.request("/popular/douban/movies?language=en-US&metadataLanguage=ja-JP", {}, {});
  assert.equal((await japanese.json() as any).data[0].title, "新语言标题");
  assert.equal(lookups, 1);
  assert.equal(JSON.stringify(snapshot), saved);
});

test("collection identity is preserved while its movie posters are localized", async (t) => {
  process.env.TMDB_API_TOKEN = "test";
  const paths: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    paths.push(url.pathname);
    if (url.pathname === "/3/collection/90") return Response.json({ id: 90, name: "Collection", parts: [{ id: 42, title: "Movie" }] });
    return Response.json({ id: 42, images: { posters: [{ file_path: "/ja.jpg", iso_639_1: "ja", width: 500, height: 750 }] } });
  });
  const response = await routes.request("/collection/details?id=90&language=en-US&posterLanguage=ja-JP");
  const data = await response.json() as any;
  assert.equal(data.id, 90);
  assert.equal(data.name, "Collection");
  assert.equal(data.parts[0].poster_path, "/ja.jpg");
  assert.deepEqual(paths, ["/3/collection/90", "/3/movie/42"]);
});

test("collection preview headings stay in App language while nested media changes", async (t) => {
  process.env.TMDB_API_TOKEN = "test";
  t.mock.method(globalThis, "fetch", async () => Response.json({ id: 42, title: "日本語の作品名", images: {} }));
  const preview = { type: "collection_preview", title: "Weekly schedule", children: {
    monday: { title: "Monday", data: [{ tmdbId: 42, media_type: "movie", title: "Saved title" }] },
  } };
  const app = new Hono();
  app.get("/", async c => c.json(await localizeMediaPayload(preview, c)));
  const response = await app.request("/?language=en-US&metadataLanguage=ja-JP");
  const data = await response.json() as any;
  assert.equal(data.title, "Weekly schedule");
  assert.equal(data.children.monday.title, "Monday");
  assert.equal(data.children.monday.data[0].title, "日本語の作品名");
  assert.equal(preview.children.monday.data[0].title, "Saved title");
});
