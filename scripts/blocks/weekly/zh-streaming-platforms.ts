/**
 * Global streaming platforms & studios (TMDB discover by network/company).
 * Submission: 全球流媒体平台 (c56528fc667a, zh-CN).
 *
 * Publishes 11 hidden child snapshots (5 TV networks + 6 movie studios)
 * consumed by a banner-style collection. Refreshed weekly (UTC+8 Sun 05:00).
 *
 * Run: bun run scripts/blocks/weekly/zh-streaming-platforms.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import {
	fetchSubmitterToken,
	fetchTmdbDiscoverItems,
	type DiscoverFilter,
} from "../lib/tmdb-discover.js";
import type { MediaType } from "../../../src/blocks/types.js";

const SUBMISSION_ID = "c56528fc667a";
const LANGUAGE = "zh-CN";

interface Section {
	blockId: string;
	title: string;
	label: string;
	mediaType: MediaType;
	discover: DiscoverFilter;
}

const SECTIONS: Section[] = [
	{
		blockId: "community-zh-netflix",
		title: "Netflix",
		label: "Netflix",
		mediaType: "tv",
		discover: { with_networks: 213 },
	},
	{
		blockId: "community-zh-disney",
		title: "Disney+",
		label: "Disney+",
		mediaType: "tv",
		discover: { with_networks: 2739 },
	},
	{
		blockId: "community-zh-hbo",
		title: "HBO",
		label: "HBO",
		mediaType: "tv",
		discover: { with_networks: 49 },
	},
	{
		blockId: "community-zh-appletv",
		title: "Apple TV+",
		label: "Apple TV+",
		mediaType: "tv",
		discover: { with_networks: 2552 },
	},
	{
		blockId: "community-zh-amazon",
		title: "Amazon",
		label: "Amazon",
		mediaType: "tv",
		discover: { with_networks: 1024 },
	},
	{
		blockId: "community-zh-marvel",
		title: "漫威 (Marvel)",
		label: "Marvel",
		mediaType: "movie",
		discover: { with_companies: 420 },
	},
	{
		blockId: "community-zh-warner",
		title: "华纳 (Warner)",
		label: "Warner",
		mediaType: "movie",
		discover: { with_companies: 174 },
	},
	{
		blockId: "community-zh-universal",
		title: "环球 (Universal)",
		label: "Universal",
		mediaType: "movie",
		discover: { with_companies: 33 },
	},
	{
		blockId: "community-zh-sony",
		title: "索尼 (Sony)",
		label: "Sony",
		mediaType: "movie",
		discover: { with_companies: 5 },
	},
	{
		blockId: "community-zh-paramount",
		title: "派拉蒙 (Paramount)",
		label: "Paramount",
		mediaType: "movie",
		discover: { with_companies: 4 },
	},
	{
		blockId: "community-zh-a24",
		title: "A24",
		label: "A24",
		mediaType: "movie",
		discover: { with_companies: 41077 },
	},
];

export { SECTIONS, SUBMISSION_ID, LANGUAGE };

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
