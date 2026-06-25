/**
 * Douban doulist "个人私藏小众文艺片" (doulist/149220206).
 * Submission: 个人私藏小众文艺片 (zh-CN, movie, thumb-list).
 *
 * Run: bun run scripts/blocks/manual/douban-indie-art-films.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchDoulistItems } from "../lib/douban.js";

await publishBlock({
	submissionId: "aac90c41e47f",
	blockId: "community-douban-indie-art-films",
	mediaType: "movie",
	language: "zh-CN",
	fetchItems: () => fetchDoulistItems("149220206"),
});
