/**
 * Fusion "Decades" widget — zh-CN counterpart of col-d8ca1fd02a45.
 * Submission token: c56528fc667a (@Zemkk).
 *
 * Run: bun run scripts/blocks/manual/zh-fusion-decades.ts
 */

import { publishFusionWidgetBlocks } from "../lib/publish-fusion-widget.js";

await publishFusionWidgetBlocks({
	submissionId: "c56528fc667a",
	language: "zh-CN",
	blockIdPrefix: "community-zh-fusion-decades",
	sourceUrl:
		"https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/json/widgets/widgets-sourced-decades-poster-mousa.a.json",
});
