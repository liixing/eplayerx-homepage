CREATE TABLE ad_scan_requests (
  id TEXT PRIMARY KEY,
  tmdb_id INTEGER NOT NULL CHECK (tmdb_id BETWEEN 1 AND 2147483647),
  title TEXT NOT NULL,
  position TEXT NOT NULL CHECK (position IN ('opening', 'midroll')),
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'waiting_resource', 'completed')),
  ongoing INTEGER NOT NULL DEFAULT 0 CHECK (ongoing IN (0, 1)),
  last_season INTEGER CHECK (last_season BETWEEN 0 AND 1000),
  last_episode INTEGER CHECK (last_episode BETWEEN 1 AND 100000),
  next_check_at INTEGER NOT NULL DEFAULT (unixepoch()),
  lease_token TEXT,
  lease_until INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (tmdb_id, position),
  CHECK ((last_season IS NULL) = (last_episode IS NULL))
) STRICT;
CREATE INDEX ad_scan_requests_pending ON ad_scan_requests (next_check_at, lease_until);
