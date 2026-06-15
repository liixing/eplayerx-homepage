/**
 * Douban doulists of films based on true stories, merged into one block.
 * Submission: This is a true story (zh-CN, movie, poster-list)
 * by @三合一.真实事件改编.
 *
 * Run: bun run scripts/blocks/manual/douban-true-story-films.ts
 */

import { publishBlock, type PublishItem } from "../../../src/blocks/publish.js";
import { fetchDoulistItems } from "../lib/douban.js";

const DOULIST_IDS = ["278539", "203399", "432407"];

function dedupeItems(items: PublishItem[]): PublishItem[] {
	const seen = new Set<string>();
	return items.filter((item) => {
		const key = `${item.title}:${item.year ?? ""}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

await publishBlock({
	submissionId: "bbb99a96fe9d",
	blockId: "community-douban-true-story-films",
	mediaType: "movie",
	language: "zh-CN",
	fetchItems: async () => {
		const lists = [];
		for (const id of DOULIST_IDS) {
			lists.push(await fetchDoulistItems(id));
		}
		return dedupeItems(lists.flat());
	},
});
