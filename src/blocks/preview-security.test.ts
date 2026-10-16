import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import app from "./index.js";

test("anonymous shared feeds render titles and image/identity attributes as data", async () => {
	let row: Record<string, unknown>;
	const env = { DB: { prepare(sql: string) {
		return { bind: (...values: unknown[]) => ({
			run: async () => {
				assert.match(sql, /INSERT INTO block_collections/);
				row = { collection_id: values[0], title: values[1], blocks_json: values[2],
					block_count: values[3], created_at: values[4], status: values[5], installs: 0 };
			},
			first: async () => row,
		}) };
	} } as unknown as D1Database };
	const response = await app.request("/collections/share", {
		method: "POST", headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ title: "Shared", blocks: [{ id: "collection", title: "Feed",
			preset: "collection-list", style: "rank", children: [{ id: "child", label: "Feed",
				source: { path: "https://example.com/feed.json" } }] }] }),
	}, env);
	assert.equal(response.status, 200);
	const { collectionId } = await response.json() as { collectionId: string };
	const html = await (await app.request(`/homepages/${collectionId}`, undefined, env)).text();
	const script = html.slice(html.indexOf("const IMG="), html.indexOf("const DETAIL="));
	assert.ok(script.includes("function fillCapsule"));
	const lines = { innerHTML: "" };
	const malicious = '<img src=x onerror="alert(1)">';
	const scope = {
		c: { querySelector: (selector: string) => selector === ".rank-lines" ? lines : null,
			classList: { contains: () => false } },
		items: [{ title: malicious }],
		item: { id: '1" onclick="alert(1)', poster_path: '/x" onerror="alert(1)', title: malicious },
	};
	runInNewContext(script + "; fillCapsule(c,items);", scope);
	assert.equal(lines.innerHTML, '<span>1. &lt;img src=x onerror=&quot;alert(1)&quot;&gt;</span>');
	const card = runInNewContext("poster(item)", scope) as string;
	assert.ok(card.includes('data-tid="1&quot; onclick=&quot;alert(1)"'));
	assert.ok(card.includes('/x&quot; onerror=&quot;alert(1)"'));
	assert.ok(!card.includes(malicious));
});
