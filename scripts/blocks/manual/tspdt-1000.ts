/**
 * TSPDT — They Shoot Pictures, Don't They? "1,000 Greatest Films" (2025).
 * Submission: TSPDT1000 (zh-CN, movie, thumb-list).
 *
 * The old ForwardWidget static source (ftufkc/ArtFilmForwardWidgets) was an
 * outdated edition missing ~50 films of the 2025 list, so all 1000 entries
 * are now pinned in tspdt-1000-data.json (official order, verified TMDB ids,
 * generated against theyshootpictures.com/gf1000_all1000films_table.php).
 * A few entries only exist on TMDB as TV (Dekalog, Heimat, ...) and carry a
 * per-item mediaType override.
 *
 * Run: bun run scripts/blocks/manual/tspdt-1000.ts
 */

import { type PublishItem, publishBlock } from "../../../src/blocks/publish.js";
import DATA from "./tspdt-1000-data.json";

await publishBlock({
	submissionId: "979448cdbe48",
	blockId: "community-tspdt-1000",
	mediaType: "movie",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: async () => DATA as PublishItem[],
});
