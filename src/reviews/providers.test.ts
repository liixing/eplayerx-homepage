import assert from "node:assert/strict";
import { test } from "node:test";
import {
	bahamutCandidates,
	bahamutFanpage,
	fetchBahamutReviews,
	fetchDoubanReviews,
	normalizedTitle,
	parseBahamutReviews,
	parseDoubanReviews,
} from "./providers.js";

const title = {
	type: "tv" as const,
	titles: ["测试作品", "測試作品", "Test Title"],
	year: 2023,
	animated: true,
};

test("Douban normalizes stars, timestamps and source URLs and rejects malformed responses", () => {
	const reviews = parseDoubanReviews({
		interests: [
			{
				id: "7",
				comment: "测试短评",
				create_time: "2023-10-01 12:30:00",
				rating: { value: 4 },
				user: { name: "读者", avatar: "https://example.com/a.png" },
				vote_count: 3,
				sharing_url:
					"https://www.douban.com/doubanapp/dispatch?uri=/movie/1/interest/7",
			},
			{ id: "8", comment: " " },
		],
	});
	assert.equal(reviews.length, 1);
	assert.equal(reviews[0].source, "douban");
	assert.equal(reviews[0].author_details.rating, 8);
	assert.equal(reviews[0].likes, 3);
	assert.equal(reviews[0].created_at, "2023-10-01T04:30:00.000Z");
	assert.ok(reviews[0].url.includes("interest/7"));
	assert.throws(() => parseDoubanReviews({ error: "blocked" }));
});

test("Douban requires an unambiguous title, media type and release year", async (t) => {
	let searches = 0;
	const matching = {
		target_type: "tv",
		target: { id: "12", title: "测试作品 第一季", year: "2023" },
	};
	const items = [
		matching,
		{ ...matching, target_type: "movie" },
		{
			target_type: "tv",
			target: { id: "14", title: "测试作品 第二季", year: "2024" },
		},
	];
	t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
		const url = String(input);
		if (url.includes("/search?")) {
			searches++;
			return Response.json({ subjects: { items } });
		}
		assert.ok(url.includes("/tv/12/interests?"));
		return Response.json({ interests: [] });
	});
	assert.equal((await fetchDoubanReviews(title)).sourceId, "12");
	await fetchDoubanReviews(title, "12");
	assert.equal(searches, 1, "known mappings do not search again");
	items.push({ ...matching, target: { ...matching.target, id: "13" } });
	assert.equal((await fetchDoubanReviews(title)).sourceId, null);
	assert.notEqual(
		normalizedTitle("测试作品 第二季"),
		normalizedTitle("测试作品"),
	);
});

test("Bahamut separates animation from manga and verifies the original premiere year", () => {
	const html = `<p class="search_title">[ 漫畫 ]<a href="//acg.gamer.com.tw/acgDetail.php?s=1">測試作品</a></p>
	<p class="search_title">[ 動畫 ]<a href="//acg.gamer.com.tw/acgDetail.php?s=2">測試作品</a></p>
	<p class="search_title">[ 動畫 ]<a href="//acg.gamer.com.tw/acgDetail.php?s=3">測試作品 第二季</a></p>`;
	assert.deepEqual(bahamutCandidates(html, title.titles), ["2"]);
	const detail =
		'<h1>測試作品</h1><li>當地首播：2023-10-01</li><button onclick="acgReview.navAllReviews(99, 4);">評價</button>';
	assert.equal(bahamutFanpage(detail, title), "99");
	assert.equal(bahamutFanpage(detail, { ...title, year: 2024 }), null);
	assert.throws(() =>
		bahamutCandidates("<html>challenge</html>", title.titles),
	);
});

test("Bahamut accepts only public reviews of the matched animation, not replies or other works", () => {
	const item = {
		id: "11",
		privacy: "1",
		content: "测试<br>评价 &amp; &#x597D;",
		ctime: "2023-10-01 12:30:00",
		likeCount: 8,
		publisher: { name: "读者", propic: "https://example.com/avatar.png" },
		reviews: { id: 99, rating: 5, dc_type: { id: 4 } },
		commented: [{ id: "12", content: "回复" }],
	};
	const reviews = parseBahamutReviews(
		{
			data: {
				list: [
					[item],
					[{ ...item, id: "13", privacy: "0" }],
					[{ ...item, id: "14", reviews: { ...item.reviews, id: 100 } }],
					[{ ...item, id: "15", content: "" }],
				],
			},
		},
		"99",
	);
	assert.equal(reviews.length, 1);
	assert.equal(reviews[0].content, "测试 评价 & 好");
	assert.equal(reviews[0].author_details.rating, 10);
	assert.equal(reviews[0].likes, 8);
	assert.equal(reviews[0].created_at, "2023-10-01T04:30:00.000Z");
	assert.throws(() => parseBahamutReviews({ error: "blocked" }, "99"));
});

test("live-action titles never trigger Bahamut requests", async (t) => {
	const fetch = t.mock.method(globalThis, "fetch", async () => {
		throw new Error("unexpected");
	});
	assert.deepEqual(await fetchBahamutReviews({ ...title, animated: false }), {
		sourceId: null,
		results: [],
	});
	assert.equal(fetch.mock.callCount(), 0);
});

test("Bahamut falls back to verified desktop pages when the JSON catalog is unavailable", async (t) => {
	t.mock.method(
		globalThis,
		"fetch",
		async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			assert.equal(new Headers(init?.headers).get("User-Agent"), "Mozilla/5.0");
			if (url.includes("/mobile_app/"))
				return new Response("Unavailable", { status: 503 });
			if (url.includes("/search.php?"))
				return new Response(
					'<p class="search_title">[ 動畫 ]<a href="//acg.gamer.com.tw/acgDetail.php?s=2">測試作品</a></p>',
				);
			if (url.includes("/acgDetail.php?s=2"))
				return new Response(
					'<h1>測試作品</h1><li>當地首播：2023-10-01</li><button onclick="acgReview.navAllReviews(99, 4);">評價</button>',
				);
			assert.equal(
				url,
				"https://api.gamer.com.tw/acg/v1/reviews_list.php?sn=99&t=4&sort=1",
			);
			return Response.json({ data: { list: [] } });
		},
	);
	assert.deepEqual(await fetchBahamutReviews(title), {
		sourceId: "99",
		results: [],
	});
});

test("Bahamut resolves first-time reviews entirely through JSON and deduplicates video editions", async (t) => {
	const requested: string[] = [];
	t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
		const url = String(input);
		requested.push(url);
		if (url.includes("/mobile_app/anime/v1/search.php?"))
			return Response.json({
				anime: [
					{
						acg_sn: 2,
						video_sn: 3,
						title: "測試作品",
						info: "年份：2023/10 共 12 集",
					},
					{
						acg_sn: 2,
						video_sn: 4,
						title: "測試作品",
						info: "年份：2023/10 共 12 集",
					},
					{
						acg_sn: 5,
						video_sn: 6,
						title: "測試作品 第二季",
						info: "年份：2024/10 共 12 集",
					},
				],
			});
		if (url === "https://api.gamer.com.tw/anime/v1/video.php?videoSn=3")
			return Response.json({
				data: {
					video: { videoSn: 3 },
					anime: {
						title: "測試作品 [1]",
						acgSn: 2,
						fanId: 99,
						seasonStart: "2023/10/01",
					},
				},
			});
		assert.equal(
			url,
			"https://api.gamer.com.tw/acg/v1/reviews_list.php?sn=99&t=4&sort=1",
		);
		return Response.json({
			data: {
				list: [
					[
						{
							id: "1",
							content: "推薦",
							privacy: "1",
							reviews: { id: 99, rating: 4, dc_type: { id: 4 } },
						},
					],
				],
			},
		});
	});
	const result = await fetchBahamutReviews(title);
	assert.equal(result.sourceId, "99");
	assert.equal(result.results[0].content, "推薦");
	assert.equal(requested.length, 3);
	assert.ok(
		requested.every((url) => new URL(url).hostname === "api.gamer.com.tw"),
	);
	requested.length = 0;
	await fetchBahamutReviews(title, "99");
	assert.equal(requested.length, 1, "known IDs still go straight to reviews");
});

test("Bahamut rejects conflicting JSON identities and falls back for uncatalogued titles", async (t) => {
	const anime = {
		title: "測試作品 [1]",
		acgSn: 2,
		fanId: 99,
		seasonStart: "2023/10/01",
	};
	let returnedAnime = { ...anime };
	let returnedVideo = 3;
	let candidates: unknown[] = [
		{ acg_sn: 2, video_sn: 3, title: "測試作品", info: "年份：2023/10" },
	];
	let reviewCalls = 0,
		htmlCalls = 0;
	t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
		const url = String(input);
		if (url.includes("/mobile_app/"))
			return Response.json({ anime: candidates });
		if (url.includes("/anime/v1/video.php"))
			return Response.json({
				data: { anime: returnedAnime, video: { videoSn: returnedVideo } },
			});
		if (url.includes("/acg/v1/reviews_list.php")) {
			reviewCalls++;
			throw new Error("must not accept conflicting identity");
		}
		htmlCalls++;
		return new Response("查無資料");
	});
	for (const change of [
		{ acgSn: 8 },
		{ title: "別的作品 [1]" },
		{ seasonStart: "2024/10/01" },
		{ fanId: 0 },
	]) {
		returnedAnime = { ...anime, ...change };
		assert.deepEqual(await fetchBahamutReviews(title), {
			sourceId: null,
			results: [],
		});
	}
	returnedAnime = anime;
	returnedVideo = 8;
	assert.deepEqual(await fetchBahamutReviews(title), {
		sourceId: null,
		results: [],
	});
	returnedVideo = 3;
	candidates = [];
	assert.deepEqual(await fetchBahamutReviews(title), {
		sourceId: null,
		results: [],
	});
	assert.equal(reviewCalls, 0);
	assert.equal(htmlCalls, 6);
});
