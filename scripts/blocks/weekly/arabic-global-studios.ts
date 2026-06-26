/**
 * Global movie studios (TMDB discover by company, newest releases).
 * Submission: منصات الإستديوهات العالمية (73fb66093626, ar-SA).
 *
 * Publishes 20 hidden child snapshots consumed by col-920cf6bb6ae0.
 * Refreshed weekly (UTC+8 Sun 05:00).
 *
 * Run: bun run scripts/blocks/weekly/arabic-global-studios.ts
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

const SUBMISSION_ID = "73fb66093626";
const LANGUAGE = "ar-SA";

const STUDIOS = GLOBAL_STUDIOS.map((studio) => ({
	blockId: studioBlockId("community-ar", studio.blockIdSuffix),
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
