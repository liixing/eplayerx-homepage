import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchSubjectCollectionItems } from "../lib/douban.js";

await publishBlock({
	submissionId: "04435f2a8a34",
	blockId: "community-douban-subject-real-time-hot",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: async () =>
		(await fetchSubjectCollectionItems("subject_real_time_hotest")).filter(
			(item) => item.mediaType === "tv" || item.mediaType === "movie",
		),
});
