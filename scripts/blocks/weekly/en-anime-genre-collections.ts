/** English Anime-Genre children for submission 218b49676e3b (@Tsarinkov). */
import { publishBlock } from "../../../src/blocks/publish.js";
import {
	animeGenreBlockId,
	fetchAnimeGenreEntries,
	fetchAnimeGenreItems,
} from "../lib/anime-genre.js";
import { fetchSubmitterToken } from "../lib/tmdb-discover.js";

const submissionId = "218b49676e3b";
const language = "en-US";
const token = await fetchSubmitterToken(submissionId);
const entries = await fetchAnimeGenreEntries();

for (const entry of entries) {
	await publishBlock({
		submissionId,
		blockId: animeGenreBlockId(entry.title, "community-en-anime-genre"),
		mediaType: "tv",
		language,
		useTmdbTitle: true,
		fetchItems: () => fetchAnimeGenreItems(token, entry, language),
	});
}
