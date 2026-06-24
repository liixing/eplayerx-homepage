/**
 * Fusion "Awards" widget — 6 Trakt award-winner movie lists.
 * Submission: Awards (de7fcc1cd18a).
 *
 * Publishes 6 hidden child snapshots for a custom image-style collection.
 *
 * Run: bun run scripts/blocks/manual/fusion-awards.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import {
	fetchFusionWidgetItems,
	fusionBlockSuffix,
} from "../lib/fusion.js";
import { fetchTraktListItems } from "../lib/trakt.js";

const SUBMISSION_ID = "de7fcc1cd18a";
const SOURCE_URL =
	"https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/json/widgets/widgets-sourced-awards-poster-mousa.a.json";

const items = await fetchFusionWidgetItems(SOURCE_URL);

let failed = false;
for (const item of items) {
	const blockId = `community-fusion-awards-${fusionBlockSuffix(item.title)}`;
	try {
		await publishBlock({
			submissionId: SUBMISSION_ID,
			blockId,
			mediaType: "movie",
			language: "ar-SA",
			useTmdbTitle: true,
			fetchItems: () =>
				fetchTraktListItems(item.username, item.listSlug, "movies"),
		});
	} catch (error) {
		failed = true;
		console.error(`✗ ${blockId} failed:`, error);
	}
}
if (failed) process.exit(1);
