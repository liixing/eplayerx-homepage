# 审核社区投稿并发布 block（agent 操作手册）

适用场景：用户说「/admin 有人投稿，去完成它」。整个流程不需要打开浏览器，
全部用 curl + 本地脚本完成：拉取待审列表 → 写抓取脚本 → 本地发布 → 接口批准 → 验证。

前置条件：`.env` 里已有 `BLOCKS_ADMIN_PASSWORD`、`R2_*`、`TMDB_API_TOKEN`（均已配置好）。
所有命令在仓库根目录 `/Users/snow/Desktop/code/eplayerx-homepage` 执行。

## 1. 登录并拉取待审投稿

审核后台没有 JSON 列表 API，待审列表是服务端渲染的 HTML，直接 curl 解析：

```bash
# 登录拿 Cookie（密码从 .env 读，注意 .env 里 = 两侧可能有空格）
PASS=$(grep BLOCKS_ADMIN_PASSWORD .env | sed 's/^[^=]*=[[:space:]]*//' | tr -d '"' | tr -d "'")
curl -s -c /tmp/cookies.txt -X POST "https://api.eplayerx.com/admin/login" --data-urlencode "password=$PASS"

# 拉取待审页（注意：URL 是 /admin 不带尾斜杠，/admin/ 会 404）
curl -s "https://api.eplayerx.com/admin" -b /tmp/cookies.txt -o /tmp/admin.html
```

用 python 去掉 HTML 标签即可读出每条投稿的关键信息：

- **投稿 ID**（12 位 hex，写进脚本的 `submissionId`）
- 名称、分类（movie/tv/anime）、展示样式（横图流 thumb-list / 竖图流 poster-list / 大图流 hero-list）
- 是否显示排行序号 / 简介、语言、作者昵称
- **数据源**（榜单 URL 或粘贴的文本）

注意：投稿者填的分类可能是错的（例如剧集榜误选 movie），批准时可以覆盖修正。

## 2. 分析数据源并写抓取脚本

先用 curl 验证数据源能抓到东西，再写脚本。常见源：

### 豆瓣（最常见）

豆瓣榜单走 `scripts/blocks/lib/douban.ts`，rexxar 移动端 API，无需登录：

- `https://m.douban.com/subject_collection/<id>` → `fetchSubjectCollectionItems("<id>")`
  （id 形如 `tv_global_best_weekly`、`movie_top250`、`ECVM47WUA`）
- `https://www.douban.com/doulist/<数字id>/` → `fetchDoulistItems("<数字id>")`

验证命令（确认 total 和条目）：

```bash
curl -s "https://m.douban.com/rexxar/api/v2/subject_collection/<id>/items?start=0&count=50" \
  -H "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1" \
  -H "Referer: https://m.douban.com/" | python3 -m json.tool | head -40
```

### 其他源

参考 `scripts/blocks/` 下已有脚本：IMDb（`weekly/imdb-popular-*.ts`）、
烂番茄（`weekly/rt-popular-tv.ts`）、巴哈姆特（`weekly/bahamut-*.ts`）、
Letterboxd（`monthly/letterboxd-*.ts`）、AniList（`weekly/anichart-seasonal.ts`）等。
全新源就照 `manual/_template.ts` 自己实现 `fetchItems`（返回 `{ title, year?, tmdbId?, altTitles? }[]`）。

### 脚本写法

按**刷新频率**选目录（投稿说周更就放 `weekly/`）：

| 目录       | 调度（UTC+8）   |
| ---------- | --------------- |
| `daily/`   | 每天 04:00      |
| `weekly/`  | 每周日 05:00    |
| `monthly/` | 每月 1 号 06:00 |
| `manual/`  | 仅手动          |

脚本模板（参考 `weekly/douban-global-best-tv.ts`）：

```ts
import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchSubjectCollectionItems } from "../lib/douban.js";

await publishBlock({
	submissionId: "<审核卡片上的投稿 ID>",
	blockId: "community-<语义名>", // 固定 id，定时重跑覆盖同一快照
	mediaType: "tv", // 或 "movie"，按内容定，不要照抄投稿者的选择
	language: "zh-CN",
	useTmdbTitle: true, // 豆瓣剧榜必开：豆瓣标题带「第X季」，存 TMDB 剧名
	// requireTvGenreIds: [TMDB_TV_GENRE_ANIMATION], // 动漫榜单加这个防错配
	fetchItems: () => fetchSubjectCollectionItems("<collection id>"),
});
```

要点：

- `blockId` 必须手动指定为 `community-<语义名>`（小写连字符），CI 重跑才能覆盖同一快照。
- `submissionId` 写投稿 ID 即可，投稿者的 TMDB token 运行时自动从 worker 获取，不会进仓库。
- 豆瓣 TV 榜单一律 `useTmdbTitle: true`；电影榜单不用。

## 3. 本地运行发布

```bash
bun run scripts/blocks/<freq>/<name>.ts
```

输出逐条匹配结果（`✅ 豆瓣标题 -> tmdbId (TMDB 标题)`）和最终快照 URL。
**逐条检查匹配是否正确**（年份、片名对得上）。有错配就在脚本里加 `KNOWN_IDS`
钉死 id 后重跑（模式见 `FIXING-BAD-DATA.md` 第 4 节）：

```ts
const KNOWN_IDS: Record<string, number> = {
	"<抓取源原始标题>": <正确的 tmdbId>,
};
// fetchItems 返回前 map 上 tmdbId，publish.ts 会跳过搜索直接按 id 取详情
```

## 4. 接口批准（不用开浏览器）

```bash
curl -s -X POST "https://api.eplayerx.com/admin/<投稿ID>/approve" \
  -b /tmp/cookies.txt -H "Content-Type: application/json" \
  -d '{
    "blockId": "community-<语义名>",
    "title": "<名称>",
    "category": "tv",
    "mediaType": "tv",
    "preset": "hero-list",
    "showRank": true,
    "showOverview": false,
    "isAnime": false
  }'
# 成功返回 {"ok":true,"blockId":"...","itemCount":N}
```

- body 里的字段会**覆盖**投稿原值，用来修正投稿者选错的分类/媒体类型。
- `category`: movie / tv / anime；`preset`: thumb-list / poster-list / hero-list。
- 必须先跑完第 3 步：approve 会校验 D1 `block_snapshots` 里有该 blockId 的发布记录。
- 驳回用 `POST /admin/<投稿ID>/reject`，body 可带 `{"reason":"..."}`。

## 4.5 周更表合集（一个投稿 → 7 个隐藏 block + 1 个合集）

巴哈姆特周更表 / MyAnimeList周更表 这类「按星期」合集，子榜单不在社区库单独
显示，只露出合集本身。流程：

1. 脚本发布 7 个快照（blockId 如 `community-<源>-monday`..`-sunday`，
   submissionId 共用同一个投稿即可，见 `weekly/mal-weekdays.ts`）。
2. 用 `POST /admin/api/register-hidden` 把每个子榜单注册为隐藏 block
   （Bearer 密码或 admin cookie 均可）：

```bash
curl -s -X POST "https://api.eplayerx.com/admin/api/register-hidden" \
  -H "Authorization: Bearer $PASS" -H "Content-Type: application/json" \
  -d '{"blockId":"community-mal-monday","title":"MAL周一新番","category":"anime",
       "mediaType":"tv","preset":"poster-list","isAnime":true,"language":"zh-CN"}'
```

3. 用 `POST /admin/collections/create`（cookie 认证）创建按星期合集，
   children 填 7 个子 blockId + 周一..周日 label + weekday 1-7。
4. 投稿没有直接对应的 approve blockId，用 SQL 标记通过即可：

```bash
bunx wrangler d1 execute blocks --remote --command \
  "UPDATE submissions SET status='approved', block_id='<col-id>', item_count=<N>,
   reviewed_at='<ISO时间>' WHERE id='<投稿ID>'"
```

隐藏 block 永久保留在 D1（`community_blocks.hidden = 1`），公开列表自动排除；
以后重建/调整合集无需任何临时操作，CI 周更也会自动同步其 item_count。

## 5. 验证

```bash
# 快照内容
curl -s "https://assets.eplayerx.com/blocks/public/<blockId>.json" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['count'], d['lastUpdated']); [print(i['title'], i['tmdbId'], i.get('first_air_date') or i.get('release_date')) for i in d['data']]"

# 社区库列表（注意分页默认 20 条，新 block installs=0 排序靠后，按分类过滤查）
curl -s "https://api.eplayerx.com/blocks/community?category=<分类>&limit=50" \
  | python3 -c "import json,sys; [print(b['id'], b['title'], b['itemCount']) for b in json.load(sys.stdin)['blocks']]"
```

## 6. 提交脚本（不要忘）

新脚本必须 commit 推到 GitHub，`.github/workflows/blocks.yml` 的定时任务才会按目录
自动刷新；不提交的话快照永远停在首次发布的版本。提交前先问用户是否要 commit。
