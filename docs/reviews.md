# 聚合评论

`GET /tmdb/{movie|tv}/reviews?id=<TMDB ID>&language=zh-CN&sources=all`

保留 TMDB 原有响应格式，`results` 追加豆瓣短评和巴哈姆特 ACG 动画作品评价。
Trakt 仍由 App 原有调用加载。省略 `sources=all` 时保持旧行为，避免旧版 App
把新来源误标为 TMDB。

新增评论字段：`source`（`douban` / `bahamut`）、`likes`、`url`；评分在
`author_details.rating`，统一为 0–10。原有 TMDB 评论没有 `source`，客户端默认 TMDB。
全部来源合并后按 `likes` 从高到低排列，赞数相同按 `created_at` 从新到旧排列；
没有赞数按 0 处理。App 合并 Trakt 评论后继续使用相同排序。

## 响应速度与缓存

- 请求只读缓存，不等待豆瓣或巴哈抓取。缓存读取最多额外等待 150ms；原有 TMDB 请求耗时另计。
- 首次请求可能只有 TMDB 评论，后台通过 Worker `waitUntil` 匹配作品并补抓，后续请求返回新增评论。
- R2 复用现有 `ASSETS` binding，键为 `reviews/v1/{type}/{id}.json`；Bun 使用已有 R2 配置。
- 成功匹配的来源一天刷新一次；未匹配六小时后重试；来源失败十五分钟后重试并保留旧评论。
- 每个来源最多保留 20 条。每个 Worker isolate 最多同时补抓 4 部作品，合并同作品的并发请求。
- 聚合响应缓存五分钟；没有新增评论时缓存三十秒。进程内快照最多保留 128 部作品。

## 匹配与范围

后台读取 TMDB 简中、繁中和原名。豆瓣要求标题、年份、电影/电视剧类型一致；
只将「第一季」视为无季号剧名，不匹配其他季。巴哈只为动画作品查询，先限定动画分类、
标题，再核对原始首播年份，最后读取对应作品粉丝页的公开评价。
匹配不唯一、来源验证失败或反爬拦截时不引入不确定的评论。

这不是动画瘋弹幕或哈啦板讨论串的抓取，也不承诺完整评论历史。
内部网页接口可能变化；新增来源故障不会阻塞原有评论，缓存中的旧评价继续可用。

## 验证

```sh
node --import tsx --test src/reviews/*.test.ts src/tmdb/cache.test.ts
npm run test:ts
```

测试覆盖来源解析、季与年份防错配、冷/热缓存、并发合并、存储延迟上限、
单来源失败保留数据和旧版接口兼容。App 端通过共用解码层识别新来源，三端显示来源名。
