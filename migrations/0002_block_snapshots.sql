-- EplayerX Blocks: snapshot publish registry.
-- The local/CI publish script (scripts/blocks/*) uploads a snapshot to R2 and
-- reports it here via POST /admin/api/report. The admin console approves from
-- this registry (no R2 round-trip), and scheduled re-runs keep item_count in
-- sync. script_path records which script refreshes which block.
CREATE TABLE IF NOT EXISTS block_snapshots (
  block_id    TEXT PRIMARY KEY,
  item_count  INTEGER NOT NULL DEFAULT 0,
  script_path TEXT,
  updated_at  TEXT NOT NULL
);
