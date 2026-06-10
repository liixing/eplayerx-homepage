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

| 变量名                  | 必需 | 说明                                            |
| ----------------------- | ---- | ----------------------------------------------- |
| `TMDB_API_TOKEN`        | ✅   | TMDB API 读取令牌                               |
| `R2_ACCESS_KEY_ID`      | ❌   | Cloudflare R2 访问密钥                          |
| `R2_SECRET_ACCESS_KEY`  | ❌   | Cloudflare R2 秘密密钥                          |
| `R2_BUCKET_NAME`        | ❌   | R2 存储桶名称                                   |
| `R2_ACCOUNT_ID`         | ❌   | Cloudflare 账户 ID                              |
| `R2_CUSTOM_DOMAIN`      | ❌   | R2 自定义域名                                   |
| `BLOCKS_ADMIN_PASSWORD` | ❌   | EplayerX Blocks 审核后台密码（`/admin`）        |

## 🧩 EplayerX Blocks（社区自定义首页）

社区投稿门户与审核后台。用户填一个任意数据源提交投稿；管理员在本地跑发布脚本抓取并上传 R2，再到审核后台填入 blockId（参数可编辑）发布到社区库供客户端拉取。

- `/blocks` 社区库（首页）　`/blocks/submit` 投稿页　`/admin` 审核后台（密码进入，普通用户无入口）
- 数据落在 Cloudflare D1（投稿/社区库）+ R2（快照），以 **Cloudflare Workers 部署为准**

审核发布流程（管理员本地操作）：

```bash
# 1) 复制脚本模板到对应“刷新频率”目录（daily/weekly/monthly/manual，由管理员决定），
#    按投稿数据源实现 fetchItems（参考 src/crawler/douban-scraper.ts）
cp scripts/blocks/manual/_template.ts scripts/blocks/weekly/<name>.ts
# 2) 本地运行：标题 -> TMDB 搜索+图片丰富 -> 上传 R2 -> 自动上报 D1（block_snapshots 表）
#    脚本里只写 submissionId（审核卡片上可复制），投稿者的 TMDB token 运行时从
#    worker 取（GET /admin/api/token/:id），不会出现在仓库里；
#    .env 需要 R2 凭证 + BLOCKS_ADMIN_PASSWORD
bun run scripts/blocks/weekly/<name>.ts
# 3) 打开 /admin，编辑投稿参数并填入 blockId，点“校验并通过”（blockId 必须唯一，纯查库不再请求 R2）
```

数据刷新（`.github/workflows/blocks.yml`）按目录分组调度，移动脚本即可改频率：

| 目录                      | 调度                       |
| ------------------------- | -------------------------- |
| `scripts/blocks/daily/`   | 每天 04:00（UTC+8）        |
| `scripts/blocks/weekly/`  | 每周日 05:00（UTC+8）      |
| `scripts/blocks/monthly/` | 每月 1 号 06:00（UTC+8）   |
| `scripts/blocks/manual/`  | 仅手动 dispatch / 本地运行 |

手动 dispatch 可填分组名或单个脚本路径（如 `weekly/bahamut-quarterly.ts`）。
脚本与 block 的对应关系记录在 `block_snapshots.script_path`。

首次启用需创建 D1 并执行迁移：

```bash
# 1) 创建数据库，把返回的 database_id 填入 wrangler.toml
wrangler d1 create eplayerx-blocks
# 2) 应用表结构（migrations/0001_blocks.sql）
wrangler d1 migrations apply eplayerx-blocks --remote
# 3) 设置审核密码
wrangler secret put BLOCKS_ADMIN_PASSWORD
```

## 📄 许可证

MIT License
