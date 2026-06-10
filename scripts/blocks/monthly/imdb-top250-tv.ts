/**
 * IMDb Top 250 TV shows (imdb.com/chart/toptv).
 * Submission: Top 250 TV shows (zh-CN, tv, poster-list, ranked) by @棒冰冰.
 *
 * IMDb itself sits behind an AWS WAF JS challenge, so this reads Trakt's
 * official mirror list (users/justin/lists/imdb-top-rated-tv-shows, rank asc)
 * which carries TMDB ids directly.
 *
 * Run: bun run scripts/blocks/monthly/imdb-top250-tv.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchTraktListItems } from "../lib/trakt.js";

await publishBlock({
	submissionId: "9381c2bef130",
	blockId: "community-imdb-top250-tv",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: () =>
		fetchTraktListItems("justin", "imdb-top-rated-tv-shows", "shows"),
});
