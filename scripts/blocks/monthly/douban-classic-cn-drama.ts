/**
 * Douban subject collection "高分经典大陆剧" (subject_collection/ECT45KVZI).
 * Submission: 豆瓣：高分经典大陆剧 (zh-CN, tv, poster-list).
 *
 * Douban titles carry season suffixes, so the TMDB localized show title
 * is stored instead of the scraped one.
 *
 * Run: bun run scripts/blocks/monthly/douban-classic-cn-drama.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchSubjectCollectionItems } from "../lib/douban.js";

await publishBlock({
	submissionId: "499a3a3c93de",
	blockId: "community-douban-classic-cn-drama",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: () => fetchSubjectCollectionItems("ECT45KVZI"),
});
