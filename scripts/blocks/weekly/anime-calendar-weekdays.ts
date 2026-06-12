/**
 * Merged Mon-Sun anime broadcast calendar from three sources:
 * Bangumi calendar (api.bgm.tv), MyAnimeList seasonal schedule and
 * Bahamut new-anime lists. Published as 7 snapshots consumed by the
 * 追番日历 weekday collection block.
 * Submission: 追番日历 (zh-CN, anime, thumb-list) by @kk.
 *
 * Per day the sources are concatenated (Bangumi order first, then MAL by
 * member count, then Bahamut); publishBlock dedupes by TMDB id so the same
 * show coming from several sources is kept once.
 *
 * Run: bun run scripts/blocks/weekly/anime-calendar-weekdays.ts
 */

import {
	publishBlock,
	type PublishItem,
} from "../../../src/blocks/publish.js";
import { TMDB_TV_GENRE_ANIMATION } from "../../../src/crawler/tmdb-enrich.js";
import { fetchBahamutQuarterly } from "../lib/bahamut.js";
import { fetchBangumiCalendarDay } from "../lib/bangumi.js";
import { fetchMalScheduleItems, type MalWeekday } from "../lib/mal.js";

const SUBMISSION_ID = "fcac0787f0cc";

const DAYS: { weekday: number; malDay: MalWeekday; blockId: string }[] = [
	{ weekday: 1, malDay: "Monday", blockId: "community-anime-calendar-monday" },
	{
		weekday: 2,
		malDay: "Tuesday",
		blockId: "community-anime-calendar-tuesday",
	},
	{
		weekday: 3,
		malDay: "Wednesday",
		blockId: "community-anime-calendar-wednesday",
	},
	{
		weekday: 4,
		malDay: "Thursday",
		blockId: "community-anime-calendar-thursday",
	},
	{ weekday: 5, malDay: "Friday", blockId: "community-anime-calendar-friday" },
	{
		weekday: 6,
		malDay: "Saturday",
		blockId: "community-anime-calendar-saturday",
	},
	{ weekday: 7, malDay: "Sunday", blockId: "community-anime-calendar-sunday" },
];

/** Pinned where the source title misses or hits the wrong TMDB entry
 * (keys are raw source titles; copied from mal-weekdays / bangumi-calendar). */
const KNOWN_IDS: Record<string, number> = {
	// Bangumi (zh-CN names)
	"Re：从零开始的异世界生活 第四季 丧失篇": 65942,
	// 2026 series; bare title search hits the 2003 OVA 新北斗神拳 (105204).
	"北斗神拳 -FIST OF THE NORTH STAR-": 295357,
	// MAL (romaji names)
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
	// Romaji search hits a 4-episode duplicate TMDB entry (319496).
	"Ichijouma Mankitsugurashi!": 295751,
};

async function fetchMergedDay(
	weekday: number,
	malDay: MalWeekday,
): Promise<PublishItem[]> {
	const [bangumi, mal, bahamut] = await Promise.all([
		fetchBangumiCalendarDay(weekday, KNOWN_IDS),
		fetchMalScheduleItems(malDay, { knownIds: KNOWN_IDS }),
		fetchBahamutQuarterly(weekday),
	]);
	// Cross-source dedupe on every known name (zh / ja / en): Bangumi carries
	// the Japanese original as altTitle and Bahamut uses it as primary, so
	// matching on alt titles drops most duplicates before the costly TMDB
	// lookups. Remaining dupes (e.g. MAL romaji) collapse on TMDB id inside
	// publishBlock.
	const merged: PublishItem[] = [];
	const seen = new Set<string>();
	for (const item of [...bangumi, ...mal, ...bahamut]) {
		const names = [item.title, ...(item.altTitles ?? [])].map((n) =>
			n.toLowerCase().trim(),
		);
		if (names.some((n) => seen.has(n))) continue;
		for (const name of names) seen.add(name);
		merged.push({ ...item, tmdbId: item.tmdbId ?? KNOWN_IDS[item.title] });
	}
	return merged;
}

// Optional day filter for partial reruns,
// e.g. `bun run ... tuesday wednesday`.
const onlyDays = process.argv.slice(2).map((d) => d.toLowerCase());
const days = onlyDays.length
	? DAYS.filter((d) => onlyDays.includes(d.malDay.toLowerCase()))
	: DAYS;

let failed = false;
for (const { weekday, malDay, blockId } of days) {
	try {
		await publishBlock({
			submissionId: SUBMISSION_ID,
			blockId,
			mediaType: "tv",
			language: "zh-CN",
			useTmdbTitle: true,
			requireTvGenreIds: [TMDB_TV_GENRE_ANIMATION],
			fetchItems: () => fetchMergedDay(weekday, malDay),
		});
	} catch (error) {
		failed = true;
		console.error(`✗ ${blockId} failed:`, error);
	}
}
if (failed) process.exit(1);
