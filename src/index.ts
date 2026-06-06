import { Hono } from "hono";
import crawlerApp from "./crawler/index.js";
import homeApp from "./home/index.js";
import tmdbApp from "./tmdb/index.js";

const app = new Hono();

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

export default app;
