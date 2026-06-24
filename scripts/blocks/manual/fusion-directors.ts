/**
 * Fusion "Directors" widget — 10 Trakt director filmography lists (Mawsa/*).
 * Submission: Directors (5eee051f932b).
 *
 * Publishes 10 hidden child snapshots for a custom banner-style collection.
 *
 * Run: bun run scripts/blocks/manual/fusion-directors.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import {
	fetchFusionWidgetItems,
	fusionBlockSuffix,
} from "../lib/fusion.js";
import { fetchTraktListItems } from "../lib/trakt.js";

const SUBMISSION_ID = "5eee051f932b";
const SOURCE_URL =
	"https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/json/widgets/widgets-sourced-directors-wide-fexm92.json";

const items = await fetchFusionWidgetItems(SOURCE_URL);

let failed = false;
for (const item of items) {
	const blockId = `community-fusion-directors-${fusionBlockSuffix(item.title)}`;
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
