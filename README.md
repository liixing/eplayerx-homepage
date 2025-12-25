# EPlayerX API 服务

[English](#english) | **简体中文**

一个基于 [Hono](https://hono.dev/) 框架构建的媒体内容 API 服务，提供 TMDB API 代理和豆瓣热门内容爬取功能。

## ☁️ 一键部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fliixing%2Feplayerx-homepage&env=TMDB_API_TOKEN&envDescription=TMDB%20API%20Token%20is%20required.%20Get%20it%20from%20https%3A%2F%2Fwww.themoviedb.org%2Fsettings%2Fapi&project-name=eplayerx-api&repository-name=eplayerx-api)

> ⚠️ **重要提示**：部署时 Vercel 会提示你填入 `TMDB_API_TOKEN` 环境变量，这是必填项。请先按照下方说明获取 Token。

## 🔑 获取 TMDB API Token

1. 访问 [TMDB 官网](https://www.themoviedb.org/) 并注册账号
2. 进入 [API 设置页面](https://www.themoviedb.org/settings/api)
3. 申请 API Key（选择 Developer 类型即可）
4. 获取 **API Read Access Token** (以 `eyJ` 开头的长字符串)
5. 在 Vercel 部署时填入此 Token

## ✨ 功能特性

- 🎬 **TMDB API 代理** - 电影、电视剧搜索、详情、图片、演职人员等
- 🔥 **豆瓣热门内容** - 爬取豆瓣热门电影、电视剧、动画、综艺节目
- 📡 **发现功能** - 按语言、平台发现电视剧内容
- 🖼️ **图片代理** - TMDB 图片代理服务，支持缓存
- ☁️ **云存储** - 使用 Cloudflare R2 存储爬取数据

## ⚙️ 环境变量

| 变量名 | 必需 | 说明 |
|--------|------|------|
| `TMDB_API_TOKEN` | ✅ | TMDB API 读取令牌 |
| `R2_ACCESS_KEY_ID` | ❌ | Cloudflare R2 访问密钥 |
| `R2_SECRET_ACCESS_KEY` | ❌ | Cloudflare R2 秘密密钥 |
| `R2_BUCKET_NAME` | ❌ | R2 存储桶名称 |
| `R2_ACCOUNT_ID` | ❌ | Cloudflare 账户 ID |
| `R2_CUSTOM_DOMAIN` | ❌ | R2 自定义域名 |

## 📄 许可证

MIT License

---

<h1 id="english">EPlayerX API Service</h1>

**English** | [简体中文](#eplayerx-api-服务)

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
