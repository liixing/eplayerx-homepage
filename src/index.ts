import { adRequestsApp, adRequestsWorkerApp } from "./ad-scan-requests.js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import adminApp from "./blocks/admin.js";
import blocksApp, { importLandingApp } from "./blocks/index.js";
import crawlerApp from "./crawler/index.js";
import homeApp from "./home/index.js";
import baiduOAuthApp from "./oauth/baidu.js";
import ratingsApp, { ratingsCacheMiddleware } from "./ratings/index.js";
import timingAdminApp from "./episode-timing-admin.js";
import { timingAdminPath } from "./episode-timing-admin-view.js";
import episodeTimingsApp from "./episode-timings.js";
import deepSeekApp from "./subtitles/deepseek.js";
import tmdbApp, { tmdbCacheMiddleware } from "./tmdb/index.js";
import tvdbApp, { tvdbCacheMiddleware } from "./tvdb/index.js";

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
app.use("/tvdb/*", publicCors);
app.use("/tvdb/*", tvdbCacheMiddleware);
app.use("/ratings", publicCors);
app.use("/ratings", ratingsCacheMiddleware);
app.use("/home/*", publicCors);
app.use("/crawler/*", publicCors);
app.use("/blocks/community", publicCors);
app.use("/blocks/data/*", publicCors);
app.use("/blocks/import-payload", publicCors);
app.use("/blocks/collections/*", publicCors);

const welcomeStrings = [
	"Hello Hono!",
	"To learn more about Hono on Vercel, visit https://vercel.com/docs/frameworks/backend/hono",
];

app.route("/oauth/baidu", baiduOAuthApp);
app.route("/subtitles/deepseek", deepSeekApp);

// Root route
app.get("/", (c) => {
	return c.text(welcomeStrings.join("\n\n"));
});

// Mount TMDB routes
app.route("/tmdb", tmdbApp);

// Mount TVDB seasons / episodes
app.route("/tvdb", tvdbApp);

// Mount multi-source ratings (MDBList)
app.route("/ratings", ratingsApp);
app.route("/episode-timings", episodeTimingsApp);
app.route("/ad-requests", adRequestsApp);
app.route("/admin/api/ad-requests", adRequestsWorkerApp);

// Mount Crawler routes
app.route("/crawler", crawlerApp);

// Mount Home routes
app.route("/home", homeApp);

// Mount EplayerX Blocks (community block builder)
app.route("/blocks", blocksApp);

// Browser fallback for the block-import universal link
app.route("/import", importLandingApp);

// Mount EplayerX Blocks admin console (password gated)
app.route(timingAdminPath, timingAdminApp);
app.route("/admin", adminApp);

export default app;
