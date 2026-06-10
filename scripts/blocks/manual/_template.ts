/**
 * Template for publishing one community block.
 *
 * Copy this file into a refresh-frequency folder (the admin's choice decides
 * how often the GitHub Action re-runs it):
 *   scripts/blocks/daily/    - refreshed every day
 *   scripts/blocks/weekly/   - refreshed every Sunday
 *   scripts/blocks/monthly/  - refreshed on the 1st of each month
 *   scripts/blocks/manual/   - only run on demand (workflow_dispatch / local)
 * Then fill in the scraper and run:
 *   bun run scripts/blocks/<freq>/<name>.ts
 *
 * It uploads the snapshot to R2, registers it in D1, and prints the public
 * URL + blockId to paste into /admin. TMDB runs with the submitter's token,
 * fetched at runtime by submissionId — never commit raw tokens to the repo.
 * .env needs the R2 credentials and BLOCKS_ADMIN_PASSWORD.
 */

import { publishBlock } from "../../../src/blocks/publish.js";

/** Per-submission scraper (same style as src/crawler/douban-scraper.ts). */
async function fetchItems(): Promise<Array<{ title: string }>> {
	return [{ title: "流浪地球" }, { title: "三体" }];
}

await publishBlock({
	submissionId: "<submission id from the /admin review card>",
	// blockId: "community-xxxx", // set to overwrite an existing snapshot
	mediaType: "movie",
	// language: "zh-CN",
	// requireTvGenreIds: [TMDB_TV_GENRE_ANIMATION], // tv-only: restrict genre
	fetchItems,
});
