/**
 * Global streaming platforms & studios (TMDB discover by network/company).
 * Submission: منصات البث العالمية (53828a7124ee, ar-SA).
 *
 * Publishes 11 hidden child snapshots (5 TV networks + 6 movie studios)
 * consumed by collection col-08c5e1d0e131. Refreshed daily (UTC+8 04:00).
 *
 * Run: bun run scripts/blocks/daily/arabic-streaming-platforms.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import {
	fetchSubmitterToken,
	fetchTmdbDiscoverItems,
	type DiscoverFilter,
} from "../lib/tmdb-discover.js";
import type { MediaType } from "../../../src/blocks/types.js";

const SUBMISSION_ID = "53828a7124ee";
const LANGUAGE = "ar-SA";

interface Section {
	blockId: string;
	title: string;
	label: string;
	mediaType: MediaType;
	discover: DiscoverFilter;
}

const SECTIONS: Section[] = [
	{
		blockId: "community-ar-netflix",
		title: "نتفليكس (Netflix)",
		label: "Netflix",
		mediaType: "tv",
		discover: { with_networks: 213 },
	},
	{
		blockId: "community-ar-disney",
		title: "ديزني بلس (Disney+)",
		label: "Disney+",
		mediaType: "tv",
		discover: { with_networks: 2739 },
	},
	{
		blockId: "community-ar-hbo",
		title: "إتش بي أو (HBO)",
		label: "HBO",
		mediaType: "tv",
		discover: { with_networks: 49 },
	},
	{
		blockId: "community-ar-appletv",
		title: "آبل تي في (+Apple TV)",
		label: "Apple TV+",
		mediaType: "tv",
		discover: { with_networks: 2552 },
	},
	{
		blockId: "community-ar-amazon",
		title: "أمازون برايم (Amazon)",
		label: "Amazon",
		mediaType: "tv",
		discover: { with_networks: 1024 },
	},
	{
		blockId: "community-ar-marvel",
		title: "مارفل (Marvel)",
		label: "Marvel",
		mediaType: "movie",
		discover: { with_companies: 420 },
	},
	{
		blockId: "community-ar-warner",
		title: "وارنر براذرز (Warner)",
		label: "Warner",
		mediaType: "movie",
		discover: { with_companies: 174 },
	},
	{
		blockId: "community-ar-universal",
		title: "يونيفرسال (Universal)",
		label: "Universal",
		mediaType: "movie",
		discover: { with_companies: 33 },
	},
	{
		blockId: "community-ar-sony",
		title: "سوني/كولومبيا (Sony)",
		label: "Sony",
		mediaType: "movie",
		discover: { with_companies: 5 },
	},
	{
		blockId: "community-ar-paramount",
		title: "باراماونت (Paramount)",
		label: "Paramount",
		mediaType: "movie",
		discover: { with_companies: 4 },
	},
	{
		blockId: "community-ar-a24",
		title: "A24",
		label: "A24",
		mediaType: "movie",
		discover: { with_companies: 41077 },
	},
];

const token = await fetchSubmitterToken(SUBMISSION_ID);

let failed = false;
for (const section of SECTIONS) {
	try {
		await publishBlock({
			submissionId: SUBMISSION_ID,
			blockId: section.blockId,
			mediaType: section.mediaType,
			language: LANGUAGE,
			useTmdbTitle: true,
			fetchItems: () =>
				fetchTmdbDiscoverItems(
					token,
					section.mediaType,
					section.discover,
					LANGUAGE,
				),
		});
	} catch (error) {
		failed = true;
		console.error(`✗ ${section.blockId} failed:`, error);
	}
}
if (failed) process.exit(1);
