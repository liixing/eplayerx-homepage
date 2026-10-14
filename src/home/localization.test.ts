import assert from "node:assert/strict";
import { test } from "node:test";
import crawler from "../crawler/index.js";
import { tvdbLanguage } from "../tvdb/client.js";
import home from "./index.js";

test("both home config versions return Vietnamese titles and TMDB language", async () => {
	for (const endpoint of ["/config", "/config/v2"]) {
		for (const language of ["vi", "vi-VN", "VI-vn"]) {
			const response = await home.request(`${endpoint}?language=${language}`);
			assert.equal(response.status, 200);
			const config = (await response.json()) as {
				blocks: Array<{
					id: string;
					title?: string;
					route?: { title: string };
					source?: { query?: { language?: string } };
				}>;
			};
			const popular = config.blocks.find(
				(block) => block.id === "tmdb-popular-movies",
			);
			assert.equal(popular?.title, "Phim điện ảnh nổi bật hôm nay");
			assert.equal(popular?.route?.title, popular?.title);
			assert.equal(popular?.source?.query?.language, language);
			assert.equal(
				config.blocks.find(
					(block) => block.id === "tmdb-discover-tv-by-language",
				)?.title,
				"Khám phá theo ngôn ngữ",
			);
		}
	}
});

test("discovery categories and language names are Vietnamese", async () => {
	for (const [endpoint, id, title] of [
		["/discover/genres", "28", "Hành động"],
		["/discover/tv-by-language/v2", "vi", "Tiếng Việt"],
		["/discover/tv-by-language/v2", "en", "Tiếng Anh"],
	]) {
		const response = await crawler.request(`${endpoint}?language=vi-VN`);
		assert.equal(response.status, 200);
		const payload = (await response.json()) as {
			data: Array<{ id: string; title: string; route: { title: string } }>;
		};
		const item = payload.data.find((item) => item.id === id);
		assert.equal(item?.title, title);
		assert.equal(item?.route.title, title);
	}
});

test("TVDB requests use the Vietnamese language code", () => {
	for (const language of ["vi", "vi-VN", " VI-vn "]) {
		assert.equal(tvdbLanguage(language), "vie");
	}
});
