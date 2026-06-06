import { type Context, Hono } from "hono";
import { createDefaultHomeConfig } from "./config.js";

const DEFAULT_IMAGE_BASE_URL = "https://image.tmdb.org/t/p";
const DEFAULT_TIMEZONE = "UTC";

const app = new Hono();

function resolveRequestLanguage(c: Context): string {
	return c.req.query("language") || "en-US";
}

app.get("/config", (c) => {
	const requestUrl = new URL(c.req.url);
	const language = resolveRequestLanguage(c);
	const timezone = c.req.query("timezone") || DEFAULT_TIMEZONE;
	const apiBaseUrl =
		c.req.query("apiBaseUrl") || process.env.API_BASE_URL || requestUrl.origin;
	const imageBaseUrl =
		c.req.query("imageBaseUrl") ||
		process.env.TMDB_IMAGE_BASE_URL ||
		DEFAULT_IMAGE_BASE_URL;

	return c.json(
		createDefaultHomeConfig({
			apiBaseUrl,
			imageBaseUrl,
			language,
			timezone,
		}),
	);
});

export default app;
