import FanartTVClient from "@fanart-tv/api";

if (!process.env.FANARTTV_API_KEY) {
  throw new Error("FANARTTV_API_KEY is not set");
}

export const fanartClient = new FanartTVClient({
  apiKey: process.env.FANARTTV_API_KEY,
  version: "v3.2", // Optional: defaults to 'v3.2' (includes width, height, image_count)
});
