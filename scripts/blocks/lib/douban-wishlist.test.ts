import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchDoubanWishlistItems } from "./douban-wishlist.js";

test("public wishlists retain order and media types, and reject incomplete pages", async () => {
	const originalFetch = globalThis.fetch;
	const card = (id: number) =>
		`<div class="item comment-item"><a href="/subject/${id}/"></a>
		<em>片名${id} &amp; &#39;标题&#39; / Original ${id}</em>
		<li class="intro">2020-01-01 / 简介</li></div>`;
	const page = (ids: number[], total: number) =>
		`<span class="subject-num">1-15&nbsp;/&nbsp;${total}</span>
		${ids.map(card).join("")}<div class="paginator"></div>`;
	const first = Array.from({ length: 15 }, (_, index) => index + 1);
	try {
		globalThis.fetch = async (input) => {
			const params = new URL(String(input)).searchParams;
			const ids =
				params.get("type") === "tv"
					? [2, 16]
					: params.get("start") === "0"
						? first
						: [16];
			return new Response(page(ids, params.get("type") === "tv" ? 2 : 16));
		};
		const rows = await fetchDoubanWishlistItems("123");
		assert.equal(rows.length, 16);
		assert.deepEqual(rows[0], {
			title: "片名1 & '标题'",
			altTitles: ["Original 1"],
			year: 2020,
			mediaType: "movie",
		});
		assert.deepEqual(
			rows.filter((row) => row.mediaType === "tv").map((row) => row.title),
			["片名2 & '标题'", "片名16 & '标题'"],
		);

		globalThis.fetch = async () => new Response("请登录后查看更多内容");
		await assert.rejects(fetchDoubanWishlistItems("123"), /requires login/);
		// Public pages can omit entries while retaining their pagination slots.
		globalThis.fetch = async (input) =>
			new Response(
				new URL(String(input)).searchParams.get("type") === "tv"
					? page([], 0)
					: page([1], 2),
			);
		assert.equal((await fetchDoubanWishlistItems("123")).length, 1);
		globalThis.fetch = async () => new Response(page([], 16));
		await assert.rejects(fetchDoubanWishlistItems("123"), /incomplete page/);
		globalThis.fetch = async (input) =>
			new Response(
				page(
					new URL(String(input)).searchParams.get("type") === "tv" ? [2] : [1],
					1,
				),
			);
		await assert.rejects(fetchDoubanWishlistItems("123"), /filters changed/);
		await assert.rejects(fetchDoubanWishlistItems("../123"), /Invalid/);
	} finally {
		globalThis.fetch = originalFetch;
	}
});
