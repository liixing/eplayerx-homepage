import assert from "node:assert/strict";
import { test } from "node:test";
import app, { importLandingApp } from "./index.js";

test("block imports reject missing sources and preserve charts and collections", async () => {
	const chart = {
		id: "chart", title: "Chart", preset: "poster-list", mediaType: "movie",
		source: { path: "/crawler/popular/movies.json" },
	};
	const collection = {
		id: "collection", title: "Collection", preset: "collection-list",
		children: [{ id: "chart", label: "Chart", source: { path: "https://example.com/data.json" } }],
	};
	const rows = [chart, collection, { id: "broken", title: "Broken", preset: "poster-list" }]
		.map(block => ({
			block_id: block.id, block_json: JSON.stringify(block),
			category: "movie", author: "Test", item_count: 1, language: "zh-CN",
		}));
	const env = { DB: {
		prepare(query: string) {
			assert.match(query, /^SELECT \* FROM community_blocks WHERE block_id IN/);
			return { bind: (...ids: string[]) => ({
				all: async () => ({ results: rows.filter(row => ids.includes(row.block_id)) }),
			}) };
		},
	} as unknown as D1Database };

	assert.equal((await app.request("/import-payload?blockId=broken", undefined, env)).status, 404);
	assert.equal((await importLandingApp.request("/blocks?blockId=broken", undefined, env)).status, 404);
	const mixed = await app.request("/collections", {
		method: "POST", headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ title: "Mixed", blockIds: ["chart", "broken"] }),
	}, env);
	assert.equal(mixed.status, 400);
	assert.deepEqual(await mixed.json(), { error: "部分区块不存在或不可用" });

	for (const block of [chart, collection]) {
		const response = await app.request(`/import-payload?blockId=${block.id}`, undefined, env);
		assert.equal(response.status, 200);
		const payload = await response.json() as { blocks: Array<Record<string, unknown>> };
		assert.equal(payload.blocks.length, 1);
		const imported = payload.blocks[0];
		assert.equal(imported.id, block.id);
		assert.equal(imported.preset, block.preset);
		assert.equal(imported.language, "zh-CN");
		if (block === collection) assert.deepEqual(imported.children, collection.children);
		else assert.deepEqual(imported.source, { path: "https://api.eplayerx.com/crawler/popular/movies.json" });
	}
});
