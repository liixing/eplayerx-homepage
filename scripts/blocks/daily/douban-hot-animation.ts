/**
 * Douban "近期热门动画" (m.douban subject_collection tv_animation — the list
 * the submitted tophub.today/n/BwdGrDXvPx page mirrors).
 * Submission: 豆瓣 ‧ 近期热门动画 (zh-CN, poster-list, rank) by @陈总.
 *
 * Run: bun run scripts/blocks/daily/douban-hot-animation.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { TMDB_TV_GENRE_ANIMATION } from "../../../src/crawler/tmdb-enrich.js";
import { fetchSubjectCollectionItems } from "../lib/douban.js";

await publishBlock({
	submissionId: "bb52a954dd8b",
	blockId: "community-douban-hot-animation",
	mediaType: "tv",
	language: "zh-CN",
	requireTvGenreIds: [TMDB_TV_GENRE_ANIMATION],
	fetchItems: () => fetchSubjectCollectionItems("tv_animation"),
});
