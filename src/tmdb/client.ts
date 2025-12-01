import createClient from "openapi-fetch";
import type { paths } from "../../lib/tmdb-api.js";

if (!process.env.TMDB_API_TOKEN) {
	throw new Error("TMDB_API_TOKEN is not set");
}

export const tmdb = createClient<paths>({
	baseUrl: process.env.PUBLIC_TMDB_API_BASE_URL || "https://api.themoviedb.org",
	headers: {
		accept: "application/json",
		Authorization: `Bearer ${process.env.TMDB_API_TOKEN}`,
	},
});
