/**
 * Standalone server entry point for Docker / local deployment.
 * Uses Bun's built-in HTTP server with Hono.
 */
import app from "./index.js";

const port = Number(process.env.PORT) || 3000;

console.log(`Server running on http://localhost:${port}`);

export default {
	port,
	fetch: app.fetch,
};
