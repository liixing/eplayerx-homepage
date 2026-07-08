import { Hono } from "hono";
import { cors } from "hono/cors";
import adminApp from "./blocks/admin.js";
import blocksApp, { importLandingApp } from "./blocks/index.js";
import crawlerApp from "./crawler/index.js";
import homeApp from "./home/index.js";
import tmdbApp, { tmdbCacheMiddleware } from "./tmdb/index.js";

const app = new Hono();

const allowedCorsOrigins = [
	"https://eplayerx.com",
	"https://www.eplayerx.com",
	"http://localhost:3000",
	"http://localhost:8787",
] as const;

const publicCors = cors({
	origin: [...allowedCorsOrigins],
	allowHeaders: ["Content-Type", "Authorization"],
	allowMethods: ["GET", "HEAD", "POST", "OPTIONS"],
	maxAge: 86400,
});

app.use("/tmdb/*", publicCors);
app.use("/tmdb/*", tmdbCacheMiddleware);
app.use("/crawler/*", publicCors);
app.use("/blocks/community", publicCors);
app.use("/blocks/data/*", publicCors);
app.use("/blocks/import-payload", publicCors);
app.use("/blocks/collections/*", publicCors);

const welcomeStrings = [
	"Hello Hono!",
	"To learn more about Hono on Vercel, visit https://vercel.com/docs/frameworks/backend/hono",
];

// Root route
app.get("/", (c) => {
	return c.text(welcomeStrings.join("\n\n"));
});

// Mount TMDB routes
app.route("/tmdb", tmdbApp);

// Mount Crawler routes
app.route("/crawler", crawlerApp);

// Mount Home routes
app.route("/home", homeApp);

// Mount EplayerX Blocks (community block builder)
app.route("/blocks", blocksApp);

// Browser fallback for the block-import universal link
app.route("/import", importLandingApp);

// Mount EplayerX Blocks admin console (password gated)
app.route("/admin", adminApp);

export default app;
