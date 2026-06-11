-- User-created block collections: a named bundle of blocks shareable via a
-- universal link (https://eplayerx.com/import/blocks?collectionId=...). The
-- blocks are frozen as importable HomeBlock JSON at creation time so the
-- payload survives later library changes.
CREATE TABLE IF NOT EXISTS block_collections (
  collection_id TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  blocks_json   TEXT NOT NULL,                -- JSON array of importable HomeBlock payloads
  block_count   INTEGER NOT NULL DEFAULT 0,
  installs      INTEGER NOT NULL DEFAULT 0,   -- best-effort import metric
  created_at    TEXT NOT NULL
);
