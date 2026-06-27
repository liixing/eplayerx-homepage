import type { TmdbListRoute } from "../../../src/blocks/types.js";

/** TMDB network ids for fusion streaming platform block suffixes. */
export const STREAMING_NETWORK_ROUTES: Record<
	string,
	{ networkId: number; networkName: string }
> = {
	netflix: { networkId: 213, networkName: "Netflix" },
	disney: { networkId: 2739, networkName: "Disney+" },
	hbomax: { networkId: 8304, networkName: "HBO Max" },
	appletv: { networkId: 2552, networkName: "Apple TV+" },
	primevideo: { networkId: 1024, networkName: "Prime Video" },
	hulu: { networkId: 453, networkName: "Hulu" },
	paramount: { networkId: 4330, networkName: "Paramount+" },
	peacock: { networkId: 3353, networkName: "Peacock" },
	crunchyroll: { networkId: 9085, networkName: "Crunchyroll" },
	discoveryplus: { networkId: 4353, networkName: "Discovery+" },
};

export function fusionStreamingBlockSuffix(blockId: string): string | null {
	const m = blockId.match(/-fusion-streaming-([a-z0-9-]+)$/);
	return m?.[1] ?? null;
}

export function tmdbNetworkDiscoverRoute(
	networkName: string,
	networkId: number,
): TmdbListRoute {
	return {
		type: "tmdb-list",
		title: networkName,
		params: {
			category: "discover",
			type: "tv",
			network: String(networkId),
			networkName,
		},
	};
}

export function routeForFusionStreamingBlock(
	blockId: string,
	label?: string,
): TmdbListRoute | undefined {
	const suffix = fusionStreamingBlockSuffix(blockId);
	if (!suffix) return undefined;
	const entry = STREAMING_NETWORK_ROUTES[suffix];
	if (!entry) return undefined;
	return tmdbNetworkDiscoverRoute(label ?? entry.networkName, entry.networkId);
}
