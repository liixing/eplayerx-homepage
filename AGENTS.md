# Agent notes

- 审核 /admin 的社区投稿并发布 block：按 `scripts/blocks/REVIEWING-SUBMISSIONS.md` 操作。
  全程 curl + 本地脚本，不用开浏览器；新脚本发布完记得提醒 commit。
- 修复已发布 block 快照里的错配影片：按 `scripts/blocks/FIXING-BAD-DATA.md` 操作。
  只用 `scripts/blocks/manual/patch-item.ts` 单点替换 + 在脚本 `KNOWN_IDS` 钉死 id，
  不要全量重发布。
