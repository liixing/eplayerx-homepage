/** Public, read-only source requests: at most three attempts on transient failures. */
export async function fetchWithRetry(
	url: string | URL,
	init?: RequestInit,
): Promise<Response> {
	for (let attempt = 0; ; attempt++) {
		let delay = 1000 * (attempt + 1);
		try {
			const response = await fetch(url, {
				...init,
				signal: AbortSignal.timeout(20_000),
			});
			if (attempt === 2 || ![429, 500, 502, 503, 504].includes(response.status))
				return response;
			const retryAfter = response.headers.get("Retry-After");
			if (retryAfter) {
				const seconds = Number(retryAfter);
				delay = Number.isFinite(seconds)
					? seconds * 1000
					: Date.parse(retryAfter) - Date.now();
				if (!Number.isFinite(delay)) delay = 1000 * (attempt + 1);
				// Do not retry earlier than requested or stall a whole refresh indefinitely.
				if (delay > 30_000) return response;
			}
			await response.body?.cancel();
			console.warn(
				`${new URL(url).hostname}: HTTP ${response.status}, retry ${attempt + 1}/2`,
			);
		} catch (error) {
			if (attempt === 2) throw error;
			console.warn(
				`${new URL(url).hostname}: request failed, retry ${attempt + 1}/2`,
			);
		}
		await new Promise((resolve) => setTimeout(resolve, Math.max(0, delay)));
	}
}
