/** All sources share one order: newest first; absent dates rank last. */
export function sortReviews<
	T extends { created_at?: string | null },
>(reviews: T[]): T[] {
	const date = (review: T) => {
		const parsed = Date.parse(review.created_at ?? "");
		return Number.isFinite(parsed) ? parsed : -Infinity;
	};
	return [...reviews].sort((a, b) => date(b) - date(a));
}
