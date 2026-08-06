/**
 * MDBList "Korean Dramas - Popular - Movies" (linvo).
 * Submission: Korean Dramas (697e2b10790d, ar-SA, poster-list) by @OY.
 *
 * Note: list is Korean *movies* (mediatype=movie), not TV dramas.
 * mdblist JSON `id` is TMDB id — skip title search.
 *
 * Run: bun run scripts/blocks/weekly/mdblist-korean-dramas-movies.ts
 * Test: LIMIT=10 bun run scripts/blocks/weekly/mdblist-korean-dramas-movies.ts
 */

import {
	type PublishItem,
	publishBlock,
} from "../../../src/blocks/publish.js";

const SUBMISSION_ID = "697e2b10790d";
const BLOCK_ID = "community-mdblist-korean-dramas-movies";
const SOURCE_URL =
	"https://mdblist.com/lists/linvo/korean-dramas-popular-movies/json";
/** Top of list is solid; past ~35 the public MDBList fills with adult/junk. */
const DEFAULT_LIMIT = 35;

interface MdblistRow {
	id?: number;
	rank?: number;
	title?: string;
	imdb_id?: string;
	mediatype?: string;
	release_year?: number;
}

async function fetchItems(): Promise<PublishItem[]> {
	const res = await fetch(SOURCE_URL, {
		headers: {
			"User-Agent":
				"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			Accept: "application/json",
		},
	});
	if (!res.ok) throw new Error(`MDBList fetch error: ${res.status}`);
	const rows = (await res.json()) as MdblistRow[];
	const limit = process.env.LIMIT
		? Number.parseInt(process.env.LIMIT, 10)
		: DEFAULT_LIMIT;

	const sorted = [...rows].sort(
		(a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9),
	);
	const out: PublishItem[] = [];
	const seen = new Set<number>();
	for (const row of sorted) {
		const title = row.title?.trim();
		if (!title) continue;
		const tmdbId =
			typeof row.id === "number" && row.id > 0 ? row.id : undefined;
		if (tmdbId) {
			if (seen.has(tmdbId)) continue;
			seen.add(tmdbId);
		}
		out.push({
			title,
			...(tmdbId ? { tmdbId } : {}),
			...(row.release_year ? { year: row.release_year } : {}),
			mediaType: "movie",
		});
		if (out.length >= limit) break;
	}
	if (!out.length) throw new Error("Empty MDBList Korean Dramas movies");
	return out;
}

await publishBlock({
	submissionId: SUBMISSION_ID,
	blockId: BLOCK_ID,
	mediaType: "movie",
	language: "ar-SA",
	useTmdbTitle: true,
	fetchItems,
});
