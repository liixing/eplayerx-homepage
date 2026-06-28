import type { TmdbListRoute } from "../../../src/blocks/types.js";

/** Per-platform TMDB discover filters for fusion streaming widgets. */
export interface StreamingRouteSpec {
	networkName: string;
	/** TMDB `with_networks` — pipe (`|`) for OR, e.g. HBO Max + HBO. */
	network?: string;
	/** TMDB `with_watch_providers` — requires `watchRegion`. */
	watchProvider?: string;
	watchRegion?: string;
}

export const STREAMING_NETWORK_ROUTES: Record<string, StreamingRouteSpec> = {
	netflix: { networkName: "Netflix", network: "213" },
	disney: { networkName: "Disney+", network: "2739" },
	hbomax: { networkName: "HBO Max", network: "8304|49" },
	appletv: { networkName: "Apple TV+", network: "2552" },
	primevideo: { networkName: "Prime Video", network: "1024" },
	hulu: { networkName: "Hulu", network: "453" },
	paramount: { networkName: "Paramount+", network: "4330" },
	peacock: { networkName: "Peacock", network: "3353" },
	// Crunchyroll has no usable TMDB network id; use US watch providers instead.
	crunchyroll: {
		networkName: "Crunchyroll",
		watchProvider: "283|1968",
		watchRegion: "US",
	},
	discoveryplus: { networkName: "Discovery+", network: "4353" },
};

export function fusionStreamingBlockSuffix(blockId: string): string | null {
	const m = blockId.match(/-fusion-streaming-([a-z0-9-]+)$/);
	return m?.[1] ?? null;
}

export function tmdbStreamingDiscoverRoute(
	networkName: string,
	spec: Pick<
		StreamingRouteSpec,
		"network" | "watchProvider" | "watchRegion"
	>,
): TmdbListRoute {
	return {
		type: "tmdb-list",
		title: networkName,
		params: {
			category: "discover",
			type: "tv",
			...(spec.network ? { network: spec.network, networkName } : {}),
			...(spec.watchProvider
				? {
						watchProvider: spec.watchProvider,
						watchRegion: spec.watchRegion ?? "US",
						networkName,
					}
				: {}),
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
	const name = label ?? entry.networkName;
	return tmdbStreamingDiscoverRoute(name, entry);
}

/** @deprecated use tmdbStreamingDiscoverRoute */
export function tmdbNetworkDiscoverRoute(
	networkName: string,
	networkId: number | string,
): TmdbListRoute {
	return tmdbStreamingDiscoverRoute(networkName, {
		network: String(networkId),
	});
}
