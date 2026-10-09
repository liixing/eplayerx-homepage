import { Hono } from "hono";

// Upstream traffic stays on each device. Only protocol settings are served here.
const youtubeClient = {
  clientName: "VISIONOS", clientVersion: "1.02", deviceMake: "Apple", deviceModel: "RealityDevice17,1",
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15",
  osName: "visionOS", osVersion: "26.5.23O471", hl: "en", timeZone: "UTC", utcOffsetMinutes: 0,
};
export const trailerRules = {
  youtubeUserAgent: youtubeClient.userAgent,
  youtubeClient: JSON.stringify(youtubeClient),
  youtubeClientName: "101",
  youtubeVisitorPattern: '"VISITOR_DATA"\\s*:\\s*"([^"\\\\]+)"',
  youtubeManifestPath: ["streamingData", "hlsManifestUrl"],
  youtubeIdentityPath: ["videoDetails", "videoId"],

};
const routes = new Hono();
routes.get("/trailers/rules", c => c.json(trailerRules, 200, {"Cache-Control":"public, max-age=300, s-maxage=300"}));
// Retire the experimental server resolver; it must never consume shared upstream quota.
routes.get("/trailers/:provider/:id", c => c.json({error:"Use client-side resolution"}, 410, {"Cache-Control":"no-store"}));
export default routes;
