/**
 * Fusion "Awards" widget — zh-CN counterpart of col-0fca77f6fcd3.
 * Submission token: c56528fc667a (@Zemkk).
 *
 * Run: bun run scripts/blocks/manual/zh-fusion-awards.ts
 */

import { publishFusionWidgetBlocks } from "../lib/publish-fusion-widget.js";

await publishFusionWidgetBlocks({
	submissionId: "c56528fc667a",
	language: "zh-CN",
	blockIdPrefix: "community-zh-fusion-awards",
	sourceUrl:
		"https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/json/widgets/widgets-sourced-awards-poster-mousa.a.json",
});
