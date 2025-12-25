# EPlayerX API Service

**English** | [简体中文](./README.md)

A media content API service built with [Hono](https://hono.dev/) framework, providing TMDB API proxy and Douban trending content scraping.

## ☁️ One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fliixing%2Feplayerx-homepage&env=TMDB_API_TOKEN&envDescription=TMDB%20API%20Token%20is%20required.%20Get%20it%20from%20https%3A%2F%2Fwww.themoviedb.org%2Fsettings%2Fapi&project-name=eplayerx-api&repository-name=eplayerx-api)

> ⚠️ **Important**: During deployment, Vercel will prompt you to enter the `TMDB_API_TOKEN` environment variable. This is required. Please obtain your Token first by following the instructions below.

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
| `R2_ACCESS_KEY_ID` | ❌ | Cloudflare R2 Access Key |
| `R2_SECRET_ACCESS_KEY` | ❌ | Cloudflare R2 Secret Key |
| `R2_BUCKET_NAME` | ❌ | R2 Bucket Name |
| `R2_ACCOUNT_ID` | ❌ | Cloudflare Account ID |
| `R2_CUSTOM_DOMAIN` | ❌ | R2 Custom Domain |

## 📄 License

MIT License

