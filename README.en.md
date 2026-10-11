# EPlayerX API Service

**English** | [简体中文](./README.md)

A media content API service built with [Hono](https://hono.dev/) framework, providing TMDB API proxy and Douban trending content scraping.

## ☁️ One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fliixing%2Feplayerx-homepage&env=TMDB_API_TOKEN&envDescription=TMDB%20API%20Token%20is%20required.%20Get%20it%20from%20https%3A%2F%2Fwww.themoviedb.org%2Fsettings%2Fapi&project-name=eplayerx-api&repository-name=eplayerx-api)

> ⚠️ **Important**: During deployment, Vercel will prompt you to enter the `TMDB_API_TOKEN` environment variable. This is required. Please obtain your Token first by following the instructions below.

## tvOS DeepSeek subtitle translation

`POST https://api.eplayerx.com/subtitles/deepseek/v1/chat/completions` accepts EPlayerX / KSPlayer single-line and batch subtitle requests.
tvOS defaults to the built-in service without client credentials. Selecting **DeepSeek** instead allows users to enter their own key for the official API. Existing custom configurations are preserved; the translation toggle remains user-controlled. Subtitle text is sent through this service to DeepSeek.

Configure the server secret and deploy to Cloudflare Workers:

```bash
npx wrangler secret put DEEPSEEK_API_KEY
npm run deploy:cf
```

Both the secret and the `SUBTITLE_RATE_LIMITER` binding in `wrangler.toml` are required; missing configuration returns 503 without contacting DeepSeek. Limits: 60 requests/minute/IP, 64 KiB request body, 30 subtitles, 4096 output tokens, 18-second upstream timeout, no automatic retries. Cloudflare limits are approximate per location and shared by users behind the same IP; they are not a global spending cap.

The server fixes the model to `deepseek-flash`, disables thinking and streaming, and rebuilds the translation prompt. Caller instructions/tools are not forwarded. Upstream error details are hidden; application code does not log or cache subtitles or keys. The plain Bun/Docker server does not enable this endpoint because it requires Workers bindings.

Validate with `node --import tsx --test src/subtitles/deepseek.test.ts` and `npm run test:ts`.

## 🔑 Get TMDB API Token

1. Visit [TMDB](https://www.themoviedb.org/) and create an account
2. Go to [API Settings](https://www.themoviedb.org/settings/api)
3. Apply for an API Key (Developer type is sufficient)
4. Get the **API Read Access Token** (long string starting with `eyJ`)
5. Enter this Token when deploying on Vercel

## ✨ Features

- 🎬 **TMDB API Proxy** - Movie & TV show search, details, images, credits, etc.
- 🔥 **Douban Trending** - Scrape trending movies, TV series, anime, variety shows from Douban
- 📡 **Discover** - Discover TV content by language and network
- 🖼️ **Image Proxy** - TMDB image proxy with caching support
- ☁️ **Cloud Storage** - Store scraped data using Cloudflare R2

## ⚙️ Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TMDB_API_TOKEN` | ✅ | TMDB API Read Access Token |
| `TVDB_API_KEY` | ❌ | TheTVDB v4 project key for `/tvdb` seasons and episodes |
| `MDBLIST_API_KEY` | ❌ | MDBList API key(s) for `GET /ratings` (comma-separated, round-robin) |
| `R2_ACCESS_KEY_ID` | ❌ | Cloudflare R2 Access Key |
| `R2_SECRET_ACCESS_KEY` | ❌ | Cloudflare R2 Secret Key |
| `R2_BUCKET_NAME` | ❌ | R2 Bucket Name |
| `R2_ACCOUNT_ID` | ❌ | Cloudflare Account ID |
| `R2_CUSTOM_DOMAIN` | ❌ | R2 Custom Domain |

## 📄 License

MIT License


Cloudflare Cron refreshes ratings for the first 20 trending movies and TV shows daily at 06:17 UTC (requires `MDBLIST_API_KEY` and R2 credentials), using about 40 MDBList lookups per day. Existing scores are refreshed, failures preserve previous values, and servers reload the ratings cache hourly. Static community lists still use the manual backfill script.
