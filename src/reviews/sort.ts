/** All sources share one order: most likes, then newest; absent values rank last. */
export function sortReviews<
	T extends { likes?: unknown; created_at?: string | null },
>(reviews: T[]): T[] {
	const likes = (review: T) =>
		typeof review.likes === "number" && Number.isFinite(review.likes)
			? Math.max(0, review.likes)
			: 0;
	const date = (review: T) =>
		review.created_at ? Date.parse(review.created_at) || 0 : 0;
	return [...reviews].sort((a, b) => likes(b) - likes(a) || date(b) - date(a));
}
