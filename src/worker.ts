/**
 * Cloudflare Workers entry point.
 * Bridges worker env bindings to process.env so existing code works unchanged.
 */
/// <reference types="@cloudflare/workers-types" />

import app from "./index.js";

type Env = Record<string, unknown>;

function syncEnv(env: Env) {
	for (const [key, value] of Object.entries(env)) {
		if (typeof value === "string") {
			process.env[key] = value;
		}
	}
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		syncEnv(env);
		return app.fetch(request, env, ctx);
	},

	async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
		syncEnv(env);
		const url = "http://localhost/crawler/cron/crawl-all";
		ctx.waitUntil(Promise.resolve(app.fetch(new Request(url), env, ctx)));
	},
};
