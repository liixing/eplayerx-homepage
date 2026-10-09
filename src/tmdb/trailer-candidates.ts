import { tmdb, type createTmdbClient } from "./client.js";

export type Video = { key?: string; site?: string; type?: string; official?: boolean; size?: number; iso_639_1?: string };
export type Details = { id?: number; original_language?: string | null; videos?: { results?: Video[] } };

export function videoLanguages(language: string, originalLanguage?: string | null) {
	return [...new Set([language.split("-")[0], originalLanguage].filter(value => /^[a-z]{2}$/.test(value ?? "")))].join(",");
}

// Cache stable identities; language also prevents a client from reusing another locale's snapshot.
export function trailerCandidates(details: Details, language: string) {
	const preferred = language.split("-")[0];
	const videos = (details.videos?.results ?? []).filter(v => v.site === "YouTube"
		&& /^(Trailer|Teaser)$/.test(v.type ?? "") && /^[A-Za-z0-9_-]{11}$/.test(v.key ?? ""));
	const localized = videos.filter(v => v.iso_639_1 === preferred);
	const selected = localized.length ? localized : videos.filter(v => !!details.original_language && v.iso_639_1 === details.original_language);
	const score = (v: Video) => (v.official ? 8 : 0) + (v.type === "Trailer" ? 4 : 0) + ((v.size ?? 0) >= 1080 ? 1 : 0);
	return { youtube: [...new Set(selected.sort((a, b) => score(b) - score(a)).map(v => v.key!))].slice(0, 3), language: preferred };
}

export async function resolveTrailerCandidates(details: Details, language: string, type: "movie" | "tv",
	queriedLanguages: string, client: ReturnType<typeof createTmdbClient> = tmdb) {
	const selected = trailerCandidates(details, language);
	const original = details.original_language;
	if (selected.youtube.length || !details.id || !/^[a-z]{2}$/.test(original ?? "") || queriedLanguages.split(",").includes(original!)) return selected;
	// A detail page may not know the original language until its first metadata response.
	const result = type === "movie"
		? await client.GET(`/3/movie/${details.id}/videos`, { params: { path: { movie_id: details.id }, query: { language: original! } } })
		: await client.GET(`/3/tv/${details.id}/videos`, { params: { path: { series_id: details.id }, query: { language: original! } } });
	if (!result.response.ok || result.data?.id !== details.id) throw new Error("Original-language trailer metadata unavailable");
	return trailerCandidates({ ...details, videos: { results: result.data?.results as Video[] ?? [] } }, language);
}
