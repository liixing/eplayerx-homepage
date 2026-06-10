/// <reference types="@cloudflare/workers-types" />
/** Shared runtime helpers for the blocks public + admin apps. */

import type { Context } from "hono";
import type { BlocksBindings } from "./types.js";

export class ServiceUnavailable extends Error {}

export function getDb(c: Context<{ Bindings: BlocksBindings }>): D1Database {
	const binding = c.env?.DB;
	if (!binding) {
		throw new ServiceUnavailable("Database not available in this environment.");
	}
	return binding;
}

export function shortId(): string {
	return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}
