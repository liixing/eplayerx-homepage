/**
 * Fusion "Decades" widget — 7 Trakt decade-movie lists (snoak/popular-*-movies).
 * Submissions: Decades (0f891075f8e4) + Yeras collection (32049cfe248c).
 *
 * Publishes 7 hidden child snapshots; the Yeras collection wraps them.
 *
 * Run: bun run scripts/blocks/manual/fusion-decades.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import {
	fetchFusionWidgetItems,
	fusionBlockSuffix,
} from "../lib/fusion.js";
import { fetchTraktListItems } from "../lib/trakt.js";

const SUBMISSION_ID = "0f891075f8e4";
const SOURCE_URL =
	"https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/json/widgets/widgets-sourced-decades-poster-mousa.a.json";

const items = await fetchFusionWidgetItems(SOURCE_URL);

let failed = false;
for (const item of items) {
	const blockId = `community-fusion-decades-${fusionBlockSuffix(item.title)}`;
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
