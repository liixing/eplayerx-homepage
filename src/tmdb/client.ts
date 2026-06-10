import createClient from "openapi-fetch";
import type { paths } from "../../lib/tmdb-api.js";

let _tmdb: ReturnType<typeof createClient<paths>> | null = null;

/** Build a TMDB client bound to a specific read-access token. */
export function createTmdbClient(token: string) {
	return createClient<paths>({
		baseUrl:
			process.env.PUBLIC_TMDB_API_BASE_URL || "https://api.themoviedb.org",
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
