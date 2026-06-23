/**
 * Marvel MCU chronological watch order from Douban note 852510825.
 * Submission: 漫威电影剧情时间顺序 (zh-CN, movie, thumb-list).
 *
 * Run: bun run scripts/blocks/manual/douban-marvel-mcu-timeline.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchDoubanNoteSubjects } from "../lib/douban.js";

await publishBlock({
	submissionId: "862aed7af962",
	blockId: "community-douban-marvel-mcu-timeline",
	mediaType: "movie",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: () => fetchDoubanNoteSubjects("852510825"),
});
