# 修复 block 快照里的错配数据（agent 操作手册）

适用场景：用户反馈某个已发布 block 里有影片匹配错了（片名/年份对不上、海报是另一部片）。
这是 TMDB 搜索漂移导致的：发布管线用本地化语言搜索、年份只做 ±1 宽松过滤、取第一个结果，
短而通用的片名（The Class、Underground、The Road…）很容易命中同名的错误条目。

核心原则：**只修错的条目，不要全量重发布。** 全量重跑慢、耗 TMDB 配额，还可能让其他条目重新漂移。

## 修复步骤

### 1. 定位 blockId 和错误条目

- block 脚本在 `scripts/blocks/{daily,weekly,monthly,manual}/` 下，脚本里写着 `blockId`。
- 公开快照地址：`https://assets.eplayerx.com/blocks/public/<blockId>.json`。
- 查看当前快照，找到错误条目的 tmdbId：

```bash
curl -s https://assets.eplayerx.com/blocks/public/<blockId>.json | jq -r '.data[] | "\(.tmdbId)\t\(.title)\t\(.release_date // .first_air_date)"'
```

### 2. 查正确的 TMDB id

用 `.env` 里的 `TMDB_API_TOKEN` 直接查 TMDB API（不要去爬网页）：

```bash
cd /Users/snow/Desktop/code/eplayerx-homepage
bun -e 'const r = await fetch("https://api.themoviedb.org/3/search/movie?query=" + encodeURIComponent("The Class") + "&primary_release_year=2008&language=en-US", { headers: { Authorization: `Bearer ${process.env.TMDB_API_TOKEN}` } }); for (const m of (await r.json()).results.slice(0,5)) console.log(m.id, m.title, m.release_date);'
```

提示：英文片名 + `primary_release_year` 通常比中文搜索准；拿不准时把 id 代回
`/3/movie/<id>` 看导演/原名确认。TMDB 上偶尔有重复条目（如 Pelle the Conqueror
同时存在 1986/1987 两条），以 Letterboxd/原始榜单链接到的那条为准。

### 3. 用 patch-item 单点替换（关键步骤）

```bash
bun run scripts/blocks/manual/patch-item.ts <blockId> <oldTmdbId:newTmdbId>... [movie|tv] [language]
# 单个：bun run scripts/blocks/manual/patch-item.ts community-letterboxd-palme-dor 12345:8841
# 批量：bun run scripts/blocks/manual/patch-item.ts community-letterboxd-palme-dor 12345:8841 4960:11490 99:20506
```

它会从 R2 下载快照一次、原位替换所有指定条目（重新拉取 TMDB 详情和图片元数据）、
再一次性传回 R2。任一 oldTmdbId 在快照里找不到会直接报错退出，不会写入半成品。
`language` 要和 block 脚本里的 `language` 一致（默认 zh-CN）。

### 4. 防止定时重跑后复发（不要跳过）

patch-item 只修当前快照；daily/weekly/monthly 脚本重跑时会按老逻辑重新搜索，错误会复发。
所以必须同时在对应 block 脚本里把正确 id 钉死。多数榜单脚本已有 `KNOWN_IDS` 映射
（key 是抓取源的原始标题，不是 TMDB 标题），照现有模式追加即可：

```ts
const KNOWN_IDS: Record<string, number> = {
  // Short generic title drifts to a near-year lookalike in zh-CN search.
  "The Class": 8841, // Entre les murs (2008)
};
```

没有 `KNOWN_IDS` 的脚本，参考 `scripts/blocks/manual/letterboxd-palme-dor.ts` 加一个，
在 `fetchItems` 返回前 `map` 上 `tmdbId`（`publish.ts` 会跳过搜索直接按 id 取详情）。

### 5. 验证

```bash
curl -s https://assets.eplayerx.com/blocks/public/<blockId>.json | jq -r '.data[] | select(.tmdbId == <newTmdbId>) | .title'
```

## 什么时候才全量重发布

仅当错误条目很多（榜单大面积错）或榜单内容本身更新了，才重跑
`bun run scripts/blocks/<schedule>/<script>.ts`。重跑前先把所有已知错配加进 `KNOWN_IDS`。
