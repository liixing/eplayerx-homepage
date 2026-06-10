/**
 * JustWatch US streaming charts (justwatch.com/us/streaming-charts?ct=daily,
 * via the public GraphQL API).
 * Submission: JustWatch Streaming Charts (zh-CN, tv, poster-list) by @kk.
 *
 * Run: bun run scripts/blocks/daily/justwatch-streaming-charts.ts
 */

import {
	type PublishItem,
	publishBlock,
} from "../../../src/blocks/publish.js";

const GRAPHQL_URL = "https://apis.justwatch.com/graphql";
const MAX_ITEMS = 50;

const QUERY = `query($country:Country!,$first:Int!){
	popularTitles(country:$country,first:$first,sortBy:TRENDING,filter:{objectTypes:[SHOW]}){
		edges{node{... on MovieOrShow{content(country:$country,language:"en"){title originalReleaseYear}}}}
	}
}`;

interface JustWatchEdge {
	node?: { content?: { title?: string; originalReleaseYear?: number } };
}

interface JustWatchResponse {
	data?: { popularTitles?: { edges?: JustWatchEdge[] } };
}

async function fetchItems(): Promise<PublishItem[]> {
	const res = await fetch(GRAPHQL_URL, {
		method: "POST",
		headers: { "Content-Type": "application/json", Accept: "application/json" },
		body: JSON.stringify({
			query: QUERY,
			variables: { country: "US", first: MAX_ITEMS },
		}),
	});
	if (!res.ok) {
		throw new Error(`JustWatch GraphQL error: ${res.status}`);
	}
	const edges =
		((await res.json()) as JustWatchResponse).data?.popularTitles?.edges ?? [];
	return edges
		.map((edge) => edge.node?.content)
		.filter((c): c is { title: string } => !!c?.title)
		.map((c) => ({ title: c.title }));
}

await publishBlock({
	submissionId: "c27efecd4c60",
	blockId: "community-justwatch-streaming-charts",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems,
});
