import type { TmdbListRoute } from "../../../src/blocks/types.js";
import { GLOBAL_STUDIOS } from "./global-studios.js";

const STUDIO_SUFFIX_TO_ID = Object.fromEntries(
	GLOBAL_STUDIOS.map((s) => [s.blockIdSuffix, s.companyId]),
);

export function studioBlockSuffix(blockId: string): string | null {
	const m = blockId.match(/-(studio-[a-z0-9-]+)$/);
	return m?.[1] ?? null;
}

export function tmdbCompanyDiscoverRoute(
	companyName: string,
	companyId: number,
): TmdbListRoute {
	return {
		type: "tmdb-list",
		title: companyName,
		params: {
			category: "discover",
			type: "movie",
			company: String(companyId),
			companyName,
		},
	};
}

export function routeForStudioBlock(
	blockId: string,
	label?: string,
): TmdbListRoute | undefined {
	const suffix = studioBlockSuffix(blockId);
	if (!suffix) return undefined;
	const companyId = STUDIO_SUFFIX_TO_ID[suffix];
	if (!companyId) return undefined;
	const studio = GLOBAL_STUDIOS.find((s) => s.blockIdSuffix === suffix);
	const name = label ?? studio?.label ?? studio?.title ?? suffix;
	return tmdbCompanyDiscoverRoute(name, companyId);
}
