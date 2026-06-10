-- EplayerX Blocks: community submission queue + approved blocks.
-- Applied with `wrangler d1 migrations apply eplayerx-blocks`.

-- Submission/review queue. One row per user submission.
-- The submitter supplies a free-form data source + their TMDB token; the admin
-- scrapes it on approval.
CREATE TABLE IF NOT EXISTS submissions (
  id              TEXT PRIMARY KEY,
  status          TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  category        TEXT NOT NULL,                   -- movie | tv | anime
  media_type      TEXT NOT NULL,                   -- movie | tv
  is_anime        INTEGER NOT NULL DEFAULT 0,
  title           TEXT NOT NULL,
  preset          TEXT NOT NULL,                   -- thumb-list | poster-list | hero-list
  show_rank       INTEGER NOT NULL DEFAULT 0,
  show_overview   INTEGER NOT NULL DEFAULT 0,
  language        TEXT NOT NULL DEFAULT 'zh-CN',    -- TMDB language param (ISO 639-1 + region)
  source_spec     TEXT NOT NULL,                   -- JSON of the free-form data source
  tmdb_token      TEXT,                            -- submitter token, used by admin to scrape
  item_count      INTEGER NOT NULL DEFAULT 0,      -- filled in after a successful scrape
  author          TEXT,                            -- optional nickname
  block_id        TEXT,                            -- set when approved
  reject_reason   TEXT,
  created_at      TEXT NOT NULL,
  reviewed_at     TEXT
);

CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions (status, created_at);

-- Approved, publicly listed blocks the client can browse and install.
CREATE TABLE IF NOT EXISTS community_blocks (
  block_id    TEXT PRIMARY KEY,
  category    TEXT NOT NULL,                        -- movie | tv | anime
  title       TEXT NOT NULL,
  block_json  TEXT NOT NULL,                        -- full HomeBlock the client consumes
  data_key    TEXT NOT NULL,                        -- R2 key of the public snapshot
  item_count  INTEGER NOT NULL DEFAULT 0,
  installs    INTEGER NOT NULL DEFAULT 0,
  author      TEXT,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_community_category ON community_blocks (category, created_at);
