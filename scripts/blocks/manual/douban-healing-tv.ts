/**
 * Douban doulist "超级治愈的电视剧" (doulist/162541727).
 * Submission: 超级治愈的电视剧 (zh-CN, movie, thumb-list) — corrected to tv.
 *
 * Run: bun run scripts/blocks/manual/douban-healing-tv.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchDoulistItems } from "../lib/douban.js";

await publishBlock({
	submissionId: "504aee854b01",
	blockId: "community-douban-healing-tv",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: () => fetchDoulistItems("162541727", { types: ["tv"] }),
});
