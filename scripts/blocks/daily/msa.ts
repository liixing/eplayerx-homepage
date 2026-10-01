/**
 * MSA (6426eee14889): seven Trakt rows and nine streaming services, en-US.
 * Source: itsrenoria/fusion-starter-kit/json/setup/setup-ttoadd.json.
 * Run with --check to validate every source without publishing.
 */
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { type PublishItem, publishBlock } from "../../../src/blocks/publish.js";
import { fusionBlockSuffix } from "../lib/fusion.js";
import { fetchTraktListItems } from "../lib/trakt.js";

interface Source {
	kind: string;
	payload: { username: string; listSlug: string };
}
interface Entry {
	title: string;
	imageURL?: string;
	dataSources: Source[];
	limit?: number;
}

export async function fetchEntries(): Promise<Entry[]> {
	const res = await fetch(
		"https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/json/setup/setup-ttoadd.json",
	);
	if (!res.ok) throw new Error(`MSA source: HTTP ${res.status}`);
	const data = (await res.json()) as {
		widgets: Array<
			Entry & { dataSource: Source & { payload: { items?: Entry[] } } }
		>;
	};
	const entries = data.widgets.flatMap((widget) =>
		widget.dataSource.kind === "collection"
			? (widget.dataSource.payload.items ?? [])
			: [{ ...widget, dataSources: [widget.dataSource] }],
	);
	assert(entries.length > 0, "MSA has no lists");
	const ids = new Set<string>();
	for (const entry of entries) {
		assert(
			entry.title?.trim() && fusionBlockSuffix(entry.title),
			"Missing title",
		);
		assert(!ids.has(fusionBlockSuffix(entry.title)), "Duplicate list title");
		ids.add(fusionBlockSuffix(entry.title));
		assert(entry.dataSources?.length, `No sources: ${entry.title}`);
		assert(
			entry.limit == null || (Number.isInteger(entry.limit) && entry.limit > 0),
		);
		for (const source of entry.dataSources) {
			assert.equal(source.kind, "traktList");
			assert(/^[\w-]+$/.test(source.payload.username), "Invalid Trakt user");
			assert(/^[\w-]+$/.test(source.payload.listSlug), "Invalid Trakt list");
			assert(
				/-(movies|shows)$/.test(source.payload.listSlug) ||
					source.payload.listSlug === "daily-picks",
				"Unknown media type",
			);
		}
	}
	return entries;
}

export async function fetchItems(entry: Entry): Promise<PublishItem[]> {
	const items: PublishItem[] = [];
	for (const { payload } of entry.dataSources) {
		const mediaType = payload.listSlug.endsWith("-shows") ? "tv" : "movie";
		const rows = await fetchTraktListItems(
			payload.username,
			payload.listSlug,
			mediaType === "tv" ? "shows" : "movies",
		);
		assert(rows.length > 0, `Empty Trakt list: ${payload.listSlug}`);
		// ponytail: 50 items per source; raise this limit if deeper service lists are needed.
		items.push(
			...rows
				.slice(0, entry.limit ?? 50)
				.map<PublishItem>((row) => ({ ...row, mediaType })),
		);
	}
	return entry.limit ? items.slice(0, entry.limit) : items;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	for (const entry of await fetchEntries()) {
		const items = await fetchItems(entry);
		assert(
			items.every(
				(item) => Number.isInteger(item.tmdbId) && (item.tmdbId ?? 0) > 0,
			),
		);
		assert.equal(
			new Set(items.map((item) => item.tmdbId)).size,
			items.length,
			"Snapshot ID collision",
		);
		console.log(`${entry.title}: ${items.length} validated TMDB IDs`);
		if (process.argv.includes("--check")) continue;
		await publishBlock({
			submissionId: "6426eee14889",
			blockId: `community-msa-${fusionBlockSuffix(entry.title)}`,
			mediaType: items[0].mediaType ?? "movie",
			language: "en-US",
			useTmdbTitle: true,
			fetchItems: async () => items,
		});
	}
}
