/**
 * TSPDT — They Shoot Pictures, Don't They? "1,000 Greatest Films".
 * Submission: TSPDT1000 (zh-CN, movie, thumb-list).
 *
 * Source is a static ForwardWidget script whose TSPDT_STATIC array already
 * carries TMDB ids, so items skip title search and fetch details directly.
 *
 * Run: bun run scripts/blocks/manual/tspdt-1000.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchForwardStaticItems } from "../lib/forward-static.js";

const SOURCE_URL =
	"https://raw.githubusercontent.com/ftufkc/ArtFilmForwardWidgets/refs/heads/main/widgets/tspdt-static.js";

await publishBlock({
	submissionId: "979448cdbe48",
	blockId: "community-tspdt-1000",
	mediaType: "movie",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: () => fetchForwardStaticItems(SOURCE_URL, "TSPDT_STATIC"),
});
