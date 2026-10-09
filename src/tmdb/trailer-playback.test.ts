import assert from "node:assert/strict";
import { test } from "node:test";
import routes from "./trailer-playback.js";

test("rules and retired resolver never call YouTube or IMDb from the server", async () => {
 const original = globalThis.fetch;
 globalThis.fetch = async () => { throw new Error("Unexpected upstream request"); };
 try {
  const response = await routes.request("/trailers/rules");
  assert.equal(response.status,200); assert.match(response.headers.get("cache-control")!, /max-age=300/);
  const rules = await response.json() as any;
  assert.equal(JSON.parse(rules.youtubeClient).clientName,"VISIONOS");
  assert.equal(new RegExp(rules.youtubeVisitorPattern).exec('"VISITOR_DATA":"guest"')?.[1],"guest");
  assert.equal(rules.imdbQuery, undefined);
  assert.equal((await routes.request("/trailers/youtube/_YUzQa_1RCE.m3u8")).status,410);
  assert.equal((await routes.request("/trailers/imdb/tt123")).status,410);
 } finally { globalThis.fetch=original; }
});
