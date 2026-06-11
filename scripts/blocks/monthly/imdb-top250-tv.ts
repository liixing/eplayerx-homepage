/**
 * IMDb Top 250 TV shows (imdb.com/chart/toptv).
 * Submission: Top 250 TV shows (zh-CN, tv, poster-list, ranked) by @棒冰冰.
 *
 * Previously read Trakt's mirror list, which lags the live chart and drops
 * entries Trakt can't match (~10 short). Now reads the chart itself via the
 * latest Wayback Machine capture (see lib/imdb-chart.ts).
 *
 * Note: the published count stays slightly under 250 because IMDb lists some
 * shows twice (original + US dub) and splits series TMDB models as one
 * (Blackadder, Granada Sherlock Holmes, Twin Peaks 2017); those collapse
 * into a single TMDB entry via KNOWN_IDS + dedupe.
 *
 * Run: bun run scripts/blocks/monthly/imdb-top250-tv.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchImdbChartTvItems } from "../lib/imdb-chart.js";

// IMDb entries TMDB models differently; /find returns nothing (or junk) for these.
const KNOWN_IDS: Record<string, number> = {
	tt0214341: 12971, // Dragon Ball Z (1996 US dub) -> Dragon Ball Z
	tt0280249: 12609, // Dragon Ball (1995 US dub) -> Dragon Ball
	tt0096548: 7246, // Blackadder Goes Forth -> Blackadder
	tt0088484: 7246, // Blackadder II -> Blackadder
	tt0092324: 7246, // Blackadder the Third -> Blackadder (own entry has no art)
	tt0090509: 799, // The Return of Sherlock Holmes -> Sherlock Holmes (Granada)
	tt4093826: 1920, // Twin Peaks (2017) -> Twin Peaks
};

await publishBlock({
	submissionId: "9381c2bef130",
	// Submitter token went 401 (revoked); fall back to the admin's own token.
	tmdbToken: process.env.TMDB_API_TOKEN,
	blockId: "community-imdb-top250-tv",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: () => fetchImdbChartTvItems("imdb.com/chart/toptv/", KNOWN_IDS),
});
