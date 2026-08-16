/**
 * Discover TV shows by network (streaming platforms) from TMDB
 * Fetches the first TV show for each streaming platform
 */

import { tmdb } from "../tmdb/client.js";
import {
  type DiscoverTVByNetworkItem,
  saveDiscoverTVByNetwork,
} from "./service.js";
import { fetchImageMeta } from "./tmdb-enrich.js";

type NetworkSpec = {
  id: number;
  name: string;
  logo_path: string;
  /** TMDB `with_networks` — pipe (`|`) for OR. Defaults to `id`. */
  network?: string;
  /** TMDB `with_watch_providers` — used when the network id catalog is too thin. */
  watchProvider?: string;
  watchRegion?: string;
};

// Streaming platform network IDs
const NETWORKS: NetworkSpec[] = [
  {
    id: 213,
    name: "Netflix",
    logo_path: "/tyHnxjQJLH6h4iDQKhN5iqebWmX.png",
  },
  { id: 453, name: "Hulu", logo_path: "/pqUTCleNUiTLAVlelGxUgWn1ELh.png" },
  { id: 2552, name: "Apple TV", logo_path: "/bngHRFi794mnMq34gfVcm9nDxN1.png" },
  { id: 2739, name: "Disney+", logo_path: "/1edZOYAfoyZyZ3rklNSiUpXX30Q.png" },
  {
    id: 8304,
    name: "HBO Max",
    logo_path: "/gqWI9y0owo9sxgzZD7TXOeILYI9.png",
    // Same OR as community fusion streaming: Max originals + HBO prestige.
    network: "8304|49",
  },
  { id: 3353, name: "Peacock", logo_path: "/gIAcGTjKKr0KOHL5s4O36roJ8p7.png" },
  {
    id: 1024,
    name: "Prime Video",
    logo_path: "/w7HfLNm9CWwRmAMU58udl2L7We7.png",
  },
  {
    id: 2007,
    name: "Tencent Video",
    logo_path: "/6Lfll43wYG2eyereOBjpYFRSGs4.png",
  },
  { id: 1330, name: "iQiyi", logo_path: "/fNxBFqWr7eWEgNeBDvvCxsSItXx.png" },
  { id: 1419, name: "Youku", logo_path: "/w2TeR3fvPZ9a617tNIF1oOfyPtk.png" },
  { id: 1631, name: "Mango TV", logo_path: "/c6GPQWwbXDuD59pGGutCBQ1T711.png" },
  { id: 1605, name: "bilibili", logo_path: "/mtmMg3PD4YGfrlmqpEiO6NL2ch9.png" },
  {
    id: 4330,
    name: "Paramount+",
    logo_path: "/fi83B1oztoS47xxcemFdPMhIzK.png",
  },
  {
    id: 4353,
    name: "Discovery+",
    logo_path: "/1D1bS3Dyw4ScYnFWTlBOvJXC3nb.png",
  },
  {
    id: 1112,
    name: "Crunchyroll",
    logo_path: "/qqyXcZlJQKlRmAD1TCKV7mGLQlt.png",
    // Network 1112 only has ~20 tagged shows; watch providers cover the catalog.
    watchProvider: "283|1968",
    watchRegion: "US",
  },
  { id: 67, name: "Showtime", logo_path: "/Allse9kbjiP6ExaQrnSpIhkurEi.png" },
  { id: 318, name: "STARZ", logo_path: "/qx3Y9LCaK4mq1ykFuDIfjshlo3U.png" },
  { id: 866, name: "tvN", logo_path: "/4iJILrndsUAvriueBVHe8u0nVqo.png" },
  { id: 885, name: "JTBC", logo_path: "/44I4aVlasm8Blb8WPGXTkMYuZJF.png" },
  { id: 3897, name: "TVING", logo_path: "/cfMtt9sNl2bDyHuoPSZouEqDB9N.png" },
  { id: 3357, name: "wavve", logo_path: "/13a2E9fbpRtQrQgfb9UCNWZcM2O.png" },
];

/**
 * Fetch top TV show by network
 */
async function fetchTVByNetwork(
  network: NetworkSpec
): Promise<DiscoverTVByNetworkItem | null> {
  try {
    const result = await tmdb.GET("/3/discover/tv", {
      params: {
        query: network.watchProvider
          ? {
              language: "zh-CN",
              with_watch_providers: network.watchProvider,
              watch_region: network.watchRegion ?? "US",
              page: 1,
            }
          : {
              language: "zh-CN",
              // TMDB accepts pipe-OR; generated types only list a single id.
              with_networks: (network.network ?? network.id) as number,
              page: 1,
            },
      },
    });

    if (result.data?.results?.[0]) {
      const tv = result.data.results[0];
      const imageMeta = await fetchImageMeta(
        tv.id as number,
        "tv",
        tv.backdrop_path,
        tv.poster_path,
        "zh-CN"
      );

      return {
        networkId: network.id,
        networkName: network.name,
        networkLogoPath: network.logo_path,
        ...(network.watchProvider
          ? {
              watchProvider: network.watchProvider,
              watchRegion: network.watchRegion ?? "US",
            }
          : network.network
            ? { network: network.network }
            : {}),
        id: tv.id as number,
        name: tv.name || "",
        original_name: tv.original_name || "",
        overview: tv.overview || null,
        poster_path: imageMeta.noLogoPoster,
        backdrop_path: tv.backdrop_path || null,
        first_air_date: tv.first_air_date || null,
        vote_average: tv.vote_average || 0,
        vote_count: tv.vote_count || 0,
        genre_ids: tv.genre_ids || [],
      };
    }

    return null;
  } catch (error) {
    console.error(`Error fetching TV for network "${network.id}":`, error);
    return null;
  }
}

/**
 * Discover TV shows by all configured networks
 */
export async function discoverTVByNetworks(): Promise<
  DiscoverTVByNetworkItem[]
> {
  console.log("📺 Discovering TV shows by network...\n");

  const results: DiscoverTVByNetworkItem[] = [];

  for (const network of NETWORKS) {
    console.log(`🔍 Fetching ${network.name} (${network.id})...`);

    const tv = await fetchTVByNetwork(network);

    if (tv) {
      results.push(tv);
      console.log(`✅ Found: ${tv.name} (${tv.original_name})`);
    } else {
      console.log(`❌ No result for ${network.name}`);
    }
  }

  console.log(`\n📊 Total: ${results.length} TV shows found`);

  return results;
}

// Run if executed directly
async function main() {
  const results = await discoverTVByNetworks();

  if (results.length > 0) {
    await saveDiscoverTVByNetwork(results);
    console.log(`\n💾 Saved ${results.length} TV shows to Cloudflare R2`);
  }

  console.log("\n📋 Results:\n");
  console.log(JSON.stringify(results, null, 2));

  return results;
}

if (process.argv[1]?.includes("discover-tv-by-network")) {
  main().catch(console.error);
}
