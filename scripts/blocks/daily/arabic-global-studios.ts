/**
 * Global movie studios (TMDB discover by company, newest releases).
 * Submission: منصات الإستديوهات العالمية (73fb66093626, ar-SA).
 *
 * Publishes 20 hidden child snapshots consumed by a banner-style collection.
 * Refreshed daily (UTC+8 04:00).
 *
 * Run: bun run scripts/blocks/daily/arabic-global-studios.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import {
	fetchSubmitterToken,
	fetchTmdbDiscoverItems,
} from "../lib/tmdb-discover.js";

const SUBMISSION_ID = "73fb66093626";
const LANGUAGE = "ar-SA";
const STUDIO_IMG_BASE =
	"https://raw.githubusercontent.com/hfip/Fusion_Collec/main/Studios/";

const STUDIOS = [
	{
		blockId: "community-ar-studio-20th-century",
		title: "20th Century Studios",
		label: "20th Century",
		companyId: 127928,
		img: "20th%20Century%20Studios.png",
	},
	{
		blockId: "community-ar-studio-a24",
		title: "A24",
		label: "A24",
		companyId: 41077,
		img: "A24.png",
	},
	{
		blockId: "community-ar-studio-amblin",
		title: "Amblin Entertainment",
		label: "Amblin",
		companyId: 56,
		img: "Amblin%20Entertainment.png",
	},
	{
		blockId: "community-ar-studio-columbia",
		title: "Columbia Pictures",
		label: "Columbia",
		companyId: 3614,
		img: "Columbia%20Pictures.png",
	},
	{
		blockId: "community-ar-studio-dc",
		title: "DC Studios",
		label: "DC",
		companyId: 429,
		img: "DC.png",
	},
	{
		blockId: "community-ar-studio-dreamworks",
		title: "DreamWorks Pictures",
		label: "DreamWorks",
		companyId: 7,
		img: "DreamWorks%20Pictures.png",
	},
	{
		blockId: "community-ar-studio-legendary",
		title: "Legendary Pictures",
		label: "Legendary",
		companyId: 923,
		img: "Legendary.png",
	},
	{
		blockId: "community-ar-studio-lionsgate",
		title: "Lionsgate",
		label: "Lionsgate",
		companyId: 1632,
		img: "Lionsgate.png",
	},
	{
		blockId: "community-ar-studio-lucasfilm",
		title: "Lucasfilm Ltd.",
		label: "Lucasfilm",
		companyId: 1,
		img: "Lucasfilm%20Ltd..png",
	},
	{
		blockId: "community-ar-studio-mgm",
		title: "Metro Goldwyn Mayer",
		label: "MGM",
		companyId: 21,
		img: "Metro-Goldwyn-Mayer.png",
	},
	{
		blockId: "community-ar-studio-millennium",
		title: "Millennium Media",
		label: "Millennium",
		companyId: 1020,
		img: "Millennium%20Media.png",
	},
	{
		blockId: "community-ar-studio-miramax",
		title: "Miramax",
		label: "Miramax",
		companyId: 14,
		img: "Miramax.png",
	},
	{
		blockId: "community-ar-studio-newline",
		title: "New Line Cinema",
		label: "New Line",
		companyId: 12,
		img: "New%20Line%20Cinema.png",
	},
	{
		blockId: "community-ar-studio-orion",
		title: "Orion Pictures",
		label: "Orion",
		companyId: 267168,
		img: "Orion%20Pictures.png",
	},
	{
		blockId: "community-ar-studio-paramount",
		title: "Paramount Pictures",
		label: "Paramount",
		companyId: 4,
		img: "Paramount%20Pictures.png",
	},
	{
		blockId: "community-ar-studio-pixar",
		title: "Pixar Animation Studios",
		label: "Pixar",
		companyId: 3,
		img: "Pixar%20Animation%20Studios.png",
	},
	{
		blockId: "community-ar-studio-sony",
		title: "Sony Pictures",
		label: "Sony",
		companyId: 11073,
		img: "Sony%20Pictures.png",
	},
	{
		blockId: "community-ar-studio-universal",
		title: "Universal Pictures",
		label: "Universal",
		companyId: 33,
		img: "Universal%20Pictures.png",
	},
	{
		blockId: "community-ar-studio-disney",
		title: "Walt Disney Pictures",
		label: "Disney",
		companyId: 2,
		img: "Walt%20Disney%20Pictures.png",
	},
	{
		blockId: "community-ar-studio-warner",
		title: "Warner Bros. Pictures",
		label: "Warner",
		companyId: 174,
		img: "Warner%20Bros.%20Pictures.png",
	},
] as const;

export { STUDIOS, STUDIO_IMG_BASE, SUBMISSION_ID, LANGUAGE };

const token = await fetchSubmitterToken(SUBMISSION_ID);

let failed = false;
for (const studio of STUDIOS) {
	try {
		await publishBlock({
			submissionId: SUBMISSION_ID,
			blockId: studio.blockId,
			mediaType: "movie",
			language: LANGUAGE,
			useTmdbTitle: true,
			fetchItems: () =>
				fetchTmdbDiscoverItems(token, "movie", {
					with_companies: studio.companyId,
					sortBy: "primary_release_date.desc",
				}, LANGUAGE),
		});
	} catch (error) {
		failed = true;
		console.error(`✗ ${studio.blockId} failed:`, error);
	}
}
if (failed) process.exit(1);
