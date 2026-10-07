import createClient from "openapi-fetch";
import type { paths } from "../../lib/tmdb-api.js";

let _tmdb: ReturnType<typeof createClient<paths>> | null = null;

const TMDB_REQUEST_TIMEOUT_MS = 20_000;

async function fetchWithTimeout(
	input: RequestInfo | URL,
	init?: RequestInit,
): Promise<Response> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), TMDB_REQUEST_TIMEOUT_MS);
	try {
		return await fetch(input, { ...init, signal: controller.signal });
	} finally {
		clearTimeout(timeout);
	}
}

/** Keep using the fallback after a rejected token; never retry other auth failures. */
export function createTmdbFetch(token: string, fallbackToken?: string) {
	let activeToken = token;
	return async (
		input: RequestInfo | URL,
		init?: RequestInit,
	): Promise<Response> => {
		const request = new Request(input, init);
		request.headers.set("Authorization", `Bearer ${activeToken}`);
		let response = await fetchWithTimeout(request.clone() as Request);
		if (
			response.status === 401 &&
			fallbackToken &&
			activeToken !== fallbackToken
		) {
			await response.body?.cancel();
			console.warn("TMDB token returned 401; switching to the admin token.");
			activeToken = fallbackToken;
			request.headers.set("Authorization", `Bearer ${activeToken}`);
			response = await fetchWithTimeout(request);
		}
		return response;
	};
}

/** Fallback is opt-in for local publishing, never implicit for user-facing requests. */
export function createTmdbClient(token: string, fallbackToken?: string) {
	return createClient<paths>({
		baseUrl:
			process.env.PUBLIC_TMDB_API_BASE_URL || "https://api.themoviedb.org",
		fetch: fallbackToken
			? createTmdbFetch(token, fallbackToken)
			: fetchWithTimeout,
		headers: {
			accept: "application/json",
			Authorization: `Bearer ${token}`,
		},
	});
}

export function getTmdb() {
	if (!_tmdb) {
		if (!process.env.TMDB_API_TOKEN) {
			throw new Error("TMDB_API_TOKEN is not set");
		}
		_tmdb = createTmdbClient(process.env.TMDB_API_TOKEN);
	}
	return _tmdb;
}

/** @deprecated Use getTmdb() instead */
export const tmdb = new Proxy({} as ReturnType<typeof createClient<paths>>, {
	get(_, prop) {
		return (getTmdb() as any)[prop];
	},
});
