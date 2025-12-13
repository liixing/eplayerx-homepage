/**
 * Discover TV shows by network (streaming platforms) from TMDB
 * Fetches the first TV show for each streaming platform
 */

import { tmdb } from "../tmdb/client.js";
import {
  type DiscoverTVByNetworkItem,
  saveDiscoverTVByNetwork,
} from "./service.js";

// Streaming platform network IDs
const NETWORKS = [
  {
    id: 2130,
    name: "Netflix",
    logo_path: "/tyHnxjQJLH6h4iDQKhN5iqebWmX.png",
  },
  { id: 453, name: "Hulu", logo_path: "/pqUTCleNUiTLAVlelGxUgWn1ELh.png" },
  { id: 2552, name: "Apple TV", logo_path: "/bngHRFi794mnMq34gfVcm9nDxN1.png" },
  { id: 2739, name: "Disney+", logo_path: "/1edZOYAfoyZyZ3rklNSiUpXX30Q.png" },
  { id: 8304, name: "HBO Max", logo_path: "/gqWI9y0owo9sxgzZD7TXOeILYI9.png" },
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
] as const;

/**
 * Fetch top TV show by network
 */
async function fetchTVByNetwork(
  networkId: number
): Promise<DiscoverTVByNetworkItem | null> {
  try {
    const result = await tmdb.GET("/3/discover/tv", {
      params: {
        query: {
          language: "zh-CN",
          with_networks: networkId,
          page: 1,
        },
      },
    });

    if (result.data?.results?.[0]) {
      const tv = result.data.results[0];
      const network = NETWORKS.find((n) => n.id === networkId);

      return {
        networkId,
        networkName: network?.name || String(networkId),
        networkLogoPath: network?.logo_path || null,
        id: tv.id as number,
        name: tv.name || "",
        original_name: tv.original_name || "",
        overview: tv.overview || null,
        poster_path: tv.poster_path || null,
        backdrop_path: tv.backdrop_path || null,
        first_air_date: tv.first_air_date || null,
        vote_average: tv.vote_average || 0,
        vote_count: tv.vote_count || 0,
        genre_ids: tv.genre_ids || [],
      };
    }

    return null;
  } catch (error) {
    console.error(`Error fetching TV for network "${networkId}":`, error);
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

    const tv = await fetchTVByNetwork(network.id);

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
