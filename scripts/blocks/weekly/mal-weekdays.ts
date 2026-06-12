/**
 * MyAnimeList Mon-Sun broadcast schedule (myanimelist.net/anime/season/schedule),
 * published as 7 snapshots consumed by the MyAnimeList 周更表 collection block.
 * Submission: MyAnimeList日更表 (zh-CN, anime, poster-list) by @宇多田光.
 *
 * Block ids must stay stable: the collection's frozen children fetch
 * /blocks/data/<blockId> straight from R2.
 *
 * Run: bun run scripts/blocks/weekly/mal-weekdays.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { TMDB_TV_GENRE_ANIMATION } from "../../../src/crawler/tmdb-enrich.js";
import { fetchMalScheduleItems, type MalWeekday } from "../lib/mal.js";

const SUBMISSION_ID = "ad0dad47cca3";

const DAYS: { day: MalWeekday; blockId: string }[] = [
	{ day: "Monday", blockId: "community-mal-monday" },
	{ day: "Tuesday", blockId: "community-mal-tuesday" },
	{ day: "Wednesday", blockId: "community-mal-wednesday" },
	{ day: "Thursday", blockId: "community-mal-thursday" },
	{ day: "Friday", blockId: "community-mal-friday" },
	{ day: "Saturday", blockId: "community-mal-saturday" },
	{ day: "Sunday", blockId: "community-mal-sunday" },
];

/** Pinned where romaji search fails or hits the wrong TMDB entry
 * (remakes, spin-offs, long-running kids shows). */
const KNOWN_IDS: Record<string, number> = {
	"Puzzle & Dragon": 80559,
	"Crayon Shin-chan": 30623,
	"Hokuto no Ken: Fist of the North Star": 295357,
	"One Piece": 37854,
	"Doraemon (2005)": 65733,
	"Sore Ike! Anpanman": 56389,
	"Bonobono (TV 2016)": 66751,
	"Chibi Maruko-chan (1995)": 57775,
	"Diamond no Ace: Act II Second Season": 60761,
	Rilakkuma: 299144,
	"Ninjala (TV)": 152271,
	"Shimajirou no Wow!": 201740,
	"Nezumi-kun no Chokki (TV)": 299962,
	"Metal Cardbot W": 223409,
};

let failed = false;
for (const { day, blockId } of DAYS) {
	try {
		await publishBlock({
			submissionId: SUBMISSION_ID,
			blockId,
			mediaType: "tv",
			language: "zh-CN",
			useTmdbTitle: true,
			requireTvGenreIds: [TMDB_TV_GENRE_ANIMATION],
			fetchItems: () => fetchMalScheduleItems(day, { knownIds: KNOWN_IDS }),
		});
	} catch (error) {
		failed = true;
		console.error(`✗ ${blockId} failed:`, error);
	}
}
if (failed) process.exit(1);
