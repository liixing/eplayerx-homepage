CREATE TABLE ad_scan_requests_by_series (
  id TEXT PRIMARY KEY,
  tmdb_id INTEGER NOT NULL UNIQUE CHECK (tmdb_id BETWEEN 1 AND 2147483647),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'waiting_resource', 'completed')),
  ongoing INTEGER NOT NULL DEFAULT 0 CHECK (ongoing IN (0, 1)),
  last_season INTEGER CHECK (last_season BETWEEN 0 AND 1000),
  last_episode INTEGER CHECK (last_episode BETWEEN 1 AND 100000),
  next_check_at INTEGER NOT NULL DEFAULT (unixepoch()),
  lease_token TEXT,
  lease_until INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  catalog_json TEXT,
  CHECK ((last_season IS NULL) = (last_episode IS NULL))
) STRICT;

CREATE TABLE ad_scan_request_aliases (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL
) STRICT;

-- Preserve the oldest ID and catalog data. A partial scan cannot finish a whole-series report.
INSERT INTO ad_scan_requests_by_series (id, tmdb_id, title, ongoing, created_at, catalog_json)
SELECT id, tmdb_id, title, ongoing, created_at, catalog_json
FROM (
  SELECT *, row_number() OVER (PARTITION BY tmdb_id ORDER BY created_at, id) AS rank
  FROM ad_scan_requests
) WHERE rank = 1;

INSERT INTO ad_scan_request_aliases (id, request_id)
SELECT legacy.id, series.id FROM ad_scan_requests AS legacy
JOIN ad_scan_requests_by_series AS series USING (tmdb_id)
WHERE legacy.id <> series.id;

DROP TABLE ad_scan_requests;
ALTER TABLE ad_scan_requests_by_series RENAME TO ad_scan_requests;
CREATE INDEX ad_scan_requests_pending ON ad_scan_requests (next_check_at, lease_until);
CREATE INDEX ad_scan_requests_created ON ad_scan_requests (created_at DESC, id DESC);
