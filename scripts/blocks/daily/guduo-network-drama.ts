/**
 * Guduo daily billboard — network drama (网剧) hot list.
 * Submission: 追剧国产 (zh-CN, tv, thumb-list) by @PaKo.
 * Source: https://d2.guduomedia.com/ (category NETWORK_DRAMA).
 *
 * Run: bun run scripts/blocks/daily/guduo-network-drama.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchGuduoBillboardItems } from "../lib/guduo.js";

await publishBlock({
	submissionId: "0bd4a46f0b89",
	blockId: "community-guduo-network-drama",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: () => fetchGuduoBillboardItems("NETWORK_DRAMA"),
});
