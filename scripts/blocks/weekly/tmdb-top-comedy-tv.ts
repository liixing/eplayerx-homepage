/**
 * English-language comedy series, popularity order.
 * Submission: Top Comedy TV (7cf44127d56a, en-US, tv, hero-list).
 *
 * Saved TMDB discover link (waf.themoviedb.org/s/ByKaQ):
 * genre Comedy, original language en, vote_average >= 5, US certs
 * TV-PG / TV-14 / TV-MA, first aired since 2010, available in ES on the
 * providers in that link. The link's air-date ceiling was about six months
 * out, so each run uses today + 180 days.
 *
 * Run: bun run scripts/blocks/weekly/tmdb-top-comedy-tv.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import {
	fetchSubmitterToken,
	fetchTmdbDiscoverItems,
} from "../lib/tmdb-discover.js";

const SUBMISSION_ID = "7cf44127d56a";
const LANGUAGE = "en-US";

function airDateLte(): string {
	const date = new Date();
	date.setUTCDate(date.getUTCDate() + 180);
	return date.toISOString().slice(0, 10);
}

const token = await fetchSubmitterToken(SUBMISSION_ID);

await publishBlock({
	submissionId: SUBMISSION_ID,
	blockId: "community-tmdb-top-comedy-tv",
	mediaType: "tv",
	language: LANGUAGE,
	useTmdbTitle: true,
	fetchItems: () =>
		fetchTmdbDiscoverItems(
			token,
			"tv",
			{
				with_genres: "35",
				withOriginalLanguage: "en",
				voteAverageGte: 5,
				firstAirDateGte: "2010-01-01",
				firstAirDateLte: airDateLte(),
				certificationCountry: "US",
				certification: "TV-PG|TV-14|TV-MA",
				watchRegion: "ES",
				withWatchProviders: "8|119|350|337|2241|1773|1899",
				withWatchMonetizationTypes: "flatrate|free|ads|rent|buy",
			},
			LANGUAGE,
		),
});
