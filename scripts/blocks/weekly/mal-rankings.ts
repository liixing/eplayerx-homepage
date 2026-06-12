/**
 * MyAnimeList extra rankings (myanimelist.net/topanime.php?type=...):
 * upcoming / favorite / airing, published as 3 hidden snapshots consumed by
 * the MyAnimeList 大合集 collection block (together with the existing
 * community-mal-top-anime and community-mal-most-popular).
 * Submission: MyAnimeList合集 (zh-CN, anime, poster-list) by @宇多田光.
 *
 * Run: bun run scripts/blocks/weekly/mal-rankings.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { TMDB_TV_GENRE_ANIMATION } from "../../../src/crawler/tmdb-enrich.js";
import { fetchMalRankingItems } from "../lib/mal.js";

const SUBMISSION_ID = "e49ec1399229";

/**
 * Pinned where romaji search fails or hits the wrong TMDB entry:
 * donghua pinyin titles, sequels/parts missing the base entry, and
 * franchise names that resolve to spin-offs. Specials/shorts are left
 * unmatched on purpose.
 */
const KNOWN_IDS: Record<string, number> = {
	// airing
	"One Piece": 37854,
	"Crayon Shin-chan": 30623,
	"Doraemon (2005)": 65733,
	"Sore Ike! Anpanman": 56389,
	"Chibi Maruko-chan (1995)": 57775,
	"Diamond no Ace: Act II Second Season": 60761,
	"Ze Tian Ji (2026)": 282158,
	"Wushen Zhuzai": 110181,
	"Shen Mu: Nian Fan": 206343,
	"Cang Yuan Tu 3": 229192,
	"Shixiong A Shixiong: Nian Fan 2": 218642,
	"Yi Ren Zhi Xia 6": 67063,
	Panlong: 283805,
	"Sou Shen Ji (ONA)": 233291,
	"Shenkong Bi An": 283119,
	// upcoming
	"Youjo Senki II": 69346,
	"Mushoku Tensei III: Isekai Ittara Honki Dasu": 94664,
	"Bleach: Sennen Kessen-hen - Kashin-tan": 30984,
	"Cyberpunk: Edgerunners 2": 105248,
	"Sousou no Frieren: Ougonkyou-hen": 209867,
	"Tensei shitara Ken deshita 2": 134667,
	"Mashle: Sanma Taisou Shinkakusha Saishuu Shiken-hen": 204832,
	"Kono Subarashii Sekai ni Shukufuku wo! 4": 65844,
	"Tokyo Revengers: Santen Sensou-hen": 105009,
	"Clevatess II: Majuu no Ou to Itsuwari no Yuusha Denshou": 258348,
	"Kimi no Koto ga Daidaidaidaidaisuki na 100-nin no Kanojo 3rd Season": 223564,
	"Katainaka no Ossan, Kensei ni Naru II": 260823,
	"Gate Season 2: Jieitai Kanoumi nite, Kaku Tatakaeri": 63663,
	"Blue Lock: Neo Egoist League": 131041,
	"Haikyuu!! Bakemono-tachi no Iku Tokoro": 60863,
	"One Punch Man 3 Part 2": 63926,
	"Tougen Anki: Nikko Kegon no Taki-hen": 253811,
	"Guimi Zhi Zhu: Wu Mian Ren": 232230,
	"Dungeon ni Deai wo Motomeru no wa Machigatteiru Darou ka 6th Season": 62745,
	"Zenchi-teki na Dokusha no Shiten kara": 258706,
	"Koukaku Kidoutai (TV)": 255358,
	// favorite
	Naruto: 46260,
	Gintama: 57041,
	"Boku no Hero Academia": 65930,
	Horimiya: 110070,
	"Bungou Stray Dogs": 65931,
	Nichijou: 44684,
	"Hajime no Ippo": 42705,
	"Fullmetal Alchemist": 37863,
	"Tensei shitara Slime Datta Ken": 82684,
	"JoJo no Kimyou na Bouken (TV)": 45790,
};

const LISTS: { type: string; blockId: string }[] = [
	{ type: "airing", blockId: "community-mal-airing" },
	{ type: "upcoming", blockId: "community-mal-upcoming" },
	{ type: "favorite", blockId: "community-mal-favorite" },
];

let failed = false;
for (const { type, blockId } of LISTS) {
	try {
		await publishBlock({
			submissionId: SUBMISSION_ID,
			blockId,
			mediaType: "tv",
			language: "zh-CN",
			useTmdbTitle: true,
			requireTvGenreIds: [TMDB_TV_GENRE_ANIMATION],
			fetchItems: () => fetchMalRankingItems({ type, knownIds: KNOWN_IDS }),
		});
	} catch (error) {
		failed = true;
		console.error(`✗ ${blockId} failed:`, error);
	}
}
if (failed) process.exit(1);
