/** Compact multi-source scores stored on list items (MDBList). */
export interface ItemRatings {
	average?: number | null;
	imdb?: number | null;
	tomatoes?: number | null;
	tomatoesAudience?: number | null;
	metacritic?: number | null;
	trakt?: number | null;
	letterboxd?: number | null;
	tmdb?: number | null;
	mal?: number | null;
}

export function ratingsCacheKey(
	mediaType: "movie" | "tv",
	tmdbId: number,
): string {
	return `${mediaType}:${tmdbId}`;
}
