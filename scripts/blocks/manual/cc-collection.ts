/**
 * The Criterion Collection master list.
 * Submission: CC标准收藏 (zh-CN, movie, thumb-list).
 *
 * Source is a static ForwardWidget script whose CC_STATIC array already
 * carries TMDB ids, so items skip title search and fetch details directly.
 *
 * Run: bun run scripts/blocks/manual/cc-collection.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchForwardStaticItems } from "../lib/forward-static.js";

const SOURCE_URL =
	"https://raw.githubusercontent.com/ftufkc/ArtFilmForwardWidgets/refs/heads/main/widgets/cc-static.js";

await publishBlock({
	submissionId: "47514dcc6628",
	blockId: "community-cc-collection",
	mediaType: "movie",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: () => fetchForwardStaticItems(SOURCE_URL, "CC_STATIC"),
});
