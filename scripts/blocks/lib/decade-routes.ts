import type { TmdbListRoute } from "../../../src/blocks/types.js";

/** Inclusive TMDB primary_release_date window per decade label. */
export const DECADE_RELEASE_WINDOWS: Record<
	string,
	{ gte: string; lte: string }
> = {
	"1960s": { gte: "1960-01-01", lte: "1969-12-31" },
	"1970s": { gte: "1970-01-01", lte: "1979-12-31" },
	"1980s": { gte: "1980-01-01", lte: "1989-12-31" },
	"1990s": { gte: "1990-01-01", lte: "1999-12-31" },
	"2000s": { gte: "2000-01-01", lte: "2009-12-31" },
	"2010s": { gte: "2010-01-01", lte: "2019-12-31" },
	"2020s": { gte: "2020-01-01", lte: "2029-12-31" },
};

export function decadeBlockSuffix(blockId: string): string | null {
	const m = blockId.match(/-fusion-decades-(\d{4}s)$/);
	return m?.[1] ?? null;
}

export function tmdbDecadeDiscoverRoute(
	decadeLabel: string,
	window: { gte: string; lte: string },
): TmdbListRoute {
	return {
		type: "tmdb-list",
		title: decadeLabel,
		params: {
			category: "discover",
			type: "movie",
			releaseDateGte: window.gte,
			releaseDateLte: window.lte,
		},
	};
}

export function routeForDecadeBlock(
	blockId: string,
	label?: string,
): TmdbListRoute | undefined {
	const suffix = decadeBlockSuffix(blockId);
	if (!suffix) return undefined;
	const window = DECADE_RELEASE_WINDOWS[suffix];
	if (!window) return undefined;
	return tmdbDecadeDiscoverRoute(label ?? suffix, window);
}
