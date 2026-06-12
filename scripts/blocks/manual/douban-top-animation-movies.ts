/**
 * Douban doulist "高分动画长片" (douban.com/doulist/223781), top-rated
 * animated feature films.
 * Submission: 高分动画长片 (zh-CN, anime, poster-list) by @douban.
 *
 * Run: bun run scripts/blocks/manual/douban-top-animation-movies.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchDoulistItems } from "../lib/douban.js";

await publishBlock({
	submissionId: "daa8f9d24031",
	blockId: "community-douban-top-animation-movies",
	mediaType: "movie",
	language: "zh-CN",
	fetchItems: () => fetchDoulistItems("223781"),
});
