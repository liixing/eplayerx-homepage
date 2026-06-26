/**
 * Fusion "Directors" widget — zh-CN counterpart of col-bdaf2557073c.
 * Submission token: c56528fc667a (@Zemkk).
 *
 * Run: bun run scripts/blocks/manual/zh-fusion-directors.ts
 */

import { publishFusionWidgetBlocks } from "../lib/publish-fusion-widget.js";

await publishFusionWidgetBlocks({
	submissionId: "c56528fc667a",
	language: "zh-CN",
	blockIdPrefix: "community-zh-fusion-directors",
	sourceUrl:
		"https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/json/widgets/widgets-sourced-directors-wide-fexm92.json",
});
