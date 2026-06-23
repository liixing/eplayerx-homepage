/**
 * Douban doulist "正午阳光/山影片单" (doulist/112220076) — curated TV dramas.
 * Submission: 正午阳光/山影片单 (zh-CN, movie, thumb-list) — corrected to tv.
 *
 * Run: bun run scripts/blocks/manual/douban-zhengyang-suns-tv.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchDoulistItems } from "../lib/douban.js";

await publishBlock({
	submissionId: "8db1a441490e",
	blockId: "community-douban-zhengyang-suns-tv",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: () => fetchDoulistItems("112220076", { types: ["tv"] }),
});
