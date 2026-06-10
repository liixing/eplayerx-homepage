/**
 * Letterboxd official Festival de Cannes "70 Years of the Palme d'Or"
 * (letterboxd.com/festival_cannes/list/70-years-of-the-palme-dor-70-ans-de-la-palme),
 * newest winner first.
 * Submission: 戛纳金棕榈 (zh-CN, movie, thumb-list) by @letterboxd.
 *
 * Run: bun run scripts/blocks/monthly/letterboxd-palme-dor.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchLetterboxdListItems } from "../lib/letterboxd.js";

/** TMDB ids pinned by hand where English-title search mismatches. */
const KNOWN_IDS: Record<string, number> = {
	// Matches an unrelated 2026 film of the same name; the winner is
	// "Un simple accident" (Jafar Panahi, 2025).
	"It Was Just an Accident": 1456349,
	// zh-CN search drifts to "Making Parasite" (2020 documentary).
	Parasite: 496243,
	// zh-CN search drifts to an unrelated 2019 film of the same name.
	Shoplifters: 505192,
	// Short generic titles below drift to near-year lookalikes in zh-CN search
	// (e.g. "The Warrior Class" 2007, "The Fair Haired Child" 2006).
	"The Class": 8841, // Entre les murs (2008)
	"The Child": 11490, // L'Enfant (2005)
	"The Eel": 20506, // Unagi (1997)
	Underground: 11902, // Kusturica (1995)
	"Pelle the Conqueror": 11174, // duplicate 1986 German entry exists on TMDB
	"The Road": 52556, // Yol (1982)
	"A Man and a Woman": 42726, // Un homme et une femme (1966)
	"The Leopard": 1040, // Il Gattopardo (1963)
	"The Damned": 87245, // Les Maudits (1947)
};

await publishBlock({
	submissionId: "f24ecc7d9b61",
	blockId: "community-letterboxd-palme-dor",
	mediaType: "movie",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: async () =>
		(
			await fetchLetterboxdListItems(
				"https://letterboxd.com/festival_cannes/list/70-years-of-the-palme-dor-70-ans-de-la-palme/",
				1,
			)
		).map((item) => ({ ...item, tmdbId: KNOWN_IDS[item.title] })),
});
