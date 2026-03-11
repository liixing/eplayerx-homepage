# EPlayerX API 服务

[English](./README.en.md) | **简体中文**

一个基于 [Hono](https://hono.dev/) 框架构建的媒体内容 API 服务，提供 TMDB API 代理和豆瓣热门内容爬取功能。

## 🚀 部署

### Docker 部署（推荐）

```bash
docker run -d \
  --name eplayerx-homepage \
  -p 3000:3000 \
  --env-file .env \
  --restart unless-stopped \
  snowleee/eplayerx-homepage:latest
```

或使用 Docker Compose，创建 `docker-compose.yml`：

```yaml
services:
  app:
    image: snowleee/eplayerx-homepage:latest
    ports:
      - "3000:3000"
    env_file:
      - .env
    restart: unless-stopped
```

```bash
docker compose up -d
```

### Vercel 部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fliixing%2Feplayerx-homepage&env=TMDB_API_TOKEN&envDescription=TMDB%20API%20Token%20is%20required.%20Get%20it%20from%20https%3A%2F%2Fwww.themoviedb.org%2Fsettings%2Fapi&project-name=eplayerx-api&repository-name=eplayerx-api)

### Cloudflare Workers 部署

```bash
npm run deploy:cf
```

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

## 🛠️ 本地开发

```bash
# 安装依赖
bun install

# 启动开发服务器（热重载）
bun run dev

# 或使用 Cloudflare Workers 本地模拟
bun run dev:cf
```

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
