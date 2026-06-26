/**
 * Global movie studios (TMDB discover by company, newest releases).
 * zh-CN counterpart of col-920cf6bb6ae0.
 * Submission token: c56528fc667a (@Zemkk).
 *
 * Refreshed weekly (UTC+8 Sun 05:00).
 *
 * Run: bun run scripts/blocks/weekly/zh-global-studios.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import {
	fetchSubmitterToken,
	fetchTmdbDiscoverItems,
} from "../lib/tmdb-discover.js";
import {
	GLOBAL_STUDIOS,
	STUDIO_IMG_BASE,
	studioBlockId,
} from "../lib/global-studios.js";

const SUBMISSION_ID = "c56528fc667a";
const LANGUAGE = "zh-CN";

const STUDIOS = GLOBAL_STUDIOS.map((studio) => ({
	blockId: studioBlockId("community-zh", studio.blockIdSuffix),
	title: studio.title,
	label: studio.label,
	companyId: studio.companyId,
	img: studio.img,
}));

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
				fetchTmdbDiscoverItems(
					token,
					"movie",
					{
						with_companies: studio.companyId,
						sortBy: "primary_release_date.desc",
					},
					LANGUAGE,
				),
		});
	} catch (error) {
		failed = true;
		console.error(`✗ ${studio.blockId} failed:`, error);
	}
}
if (failed) process.exit(1);
