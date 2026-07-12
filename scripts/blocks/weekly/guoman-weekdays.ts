/**
 * Chinese-anime (国漫) Mon-Sun update schedule from @陈总's GitHub JSON.
 * Published as 7 hidden snapshots consumed by the 国漫周更表 collection.
 *
 * Submissions:
 *   周一 05b724dd665c · 周二 c8cadc394c16 · 周三 298128ee8b32 · 周四 0394992a3236
 *   周五 ef6b1f626d97 · 周六 c7dcba971765 · 周日 2aae7f533c96
 *
 * Run: bun run scripts/blocks/weekly/guoman-weekdays.ts
 * Then: bun run scripts/blocks/manual/register-guoman-weekdays.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { TMDB_TV_GENRE_ANIMATION } from "../../../src/crawler/tmdb-enrich.js";
import {
	fetchGuomanWeekday,
	GUOMAN_DAYS,
} from "../lib/guoman-weekdays.js";

/** One submission token is enough — all seven share the same submitter. */
const SUBMISSION_ID = "05b724dd665c";

let failed = false;
for (const { file, blockId } of GUOMAN_DAYS) {
	try {
		await publishBlock({
			submissionId: SUBMISSION_ID,
			blockId,
			mediaType: "tv",
			language: "zh-CN",
			useTmdbTitle: true,
			requireTvGenreIds: [TMDB_TV_GENRE_ANIMATION],
			fetchItems: () => fetchGuomanWeekday(file),
		});
	} catch (error) {
		failed = true;
		console.error(`✗ ${blockId} failed:`, error);
	}
}
if (failed) process.exit(1);
