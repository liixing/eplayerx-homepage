/**
 * Bahamut Mon-Sun new-anime lists (acg.gamer.com.tw/quarterly.php?d=1..7),
 * published as 7 snapshots consumed by the 新番周更表 collection block.
 *
 * Block ids must stay stable: installed clients and the collection's frozen
 * children fetch /blocks/data/<blockId> straight from R2.
 *
 * Run: bun run scripts/blocks/weekly/bahamut-weekdays.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { TMDB_TV_GENRE_ANIMATION } from "../../../src/crawler/tmdb-enrich.js";
import { fetchBahamutQuarterly } from "../lib/bahamut.js";

const DAYS = [
	{ day: 1, submissionId: "817ef5c2f1d0", blockId: "community-bahamut-monday" },
	// Tuesday kept its historical "quarterly" block id.
	{
		day: 2,
		submissionId: "ae9b098505e1",
		blockId: "community-bahamut-quarterly",
	},
	{
		day: 3,
		submissionId: "64d0ea98bb5d",
		blockId: "community-bahamut-wednesday",
	},
	{
		day: 4,
		submissionId: "22bef2c1b766",
		blockId: "community-bahamut-thursday",
	},
	{ day: 5, submissionId: "a7a57083ca62", blockId: "community-bahamut-friday" },
	{
		day: 6,
		submissionId: "1f77db8171d5",
		blockId: "community-bahamut-saturday",
	},
	{ day: 7, submissionId: "b4da421999ef", blockId: "community-bahamut-sunday" },
] as const;

let failed = false;
for (const { day, submissionId, blockId } of DAYS) {
	try {
		await publishBlock({
			submissionId,
			blockId,
			mediaType: "tv",
			language: "zh-CN",
			useTmdbTitle: true,
			requireTvGenreIds: [TMDB_TV_GENRE_ANIMATION],
			fetchItems: () => fetchBahamutQuarterly(day),
		});
	} catch (error) {
		failed = true;
		console.error(`✗ ${blockId} failed:`, error);
	}
}
if (failed) process.exit(1);
