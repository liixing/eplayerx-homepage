/**
 * Fusion streaming platforms widget — Trakt lists per service.
 * Submission: الشبكات العالمية (71a92afd3781, ar-SA).
 *
 * Publishes hidden child snapshots consumed by col-6a13376e26f8.
 * Refreshed weekly (UTC+8 Sun 05:00).
 *
 * Run: bun run scripts/blocks/weekly/arabic-fusion-streaming.ts
 */

import { publishFusionStreamingBlocks } from "../lib/publish-fusion-widget.js";

export const SUBMISSION_ID = "71a92afd3781";
export const LANGUAGE = "ar-SA";
export const SOURCE_URL =
	"https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/json/widgets/widgets-sourced-streaming-wide-rdnoni-transparent.json";

export const children = await publishFusionStreamingBlocks({
	submissionId: SUBMISSION_ID,
	language: LANGUAGE,
	blockIdPrefix: "community-ar-fusion-streaming",
	sourceUrl: SOURCE_URL,
});

console.log("\nCollection children spec:");
for (const child of children) {
	console.log(
		`${child.blockId} | ${child.label}${child.image ? ` | ${child.image}` : ""}`,
	);
}
