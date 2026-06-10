# Agent notes

- 修复已发布 block 快照里的错配影片：按 `scripts/blocks/FIXING-BAD-DATA.md` 操作。
  只用 `scripts/blocks/manual/patch-item.ts` 单点替换 + 在脚本 `KNOWN_IDS` 钉死 id，
  不要全量重发布。
