-- Existing advertisement reports are partial until a client reports completion.
CREATE TABLE screen_ad_scan_completions (
  tmdb_id INTEGER NOT NULL CHECK (tmdb_id BETWEEN 1 AND 2147483647),
  season INTEGER NOT NULL CHECK (season BETWEEN 0 AND 1000),
  episode INTEGER NOT NULL CHECK (episode BETWEEN 1 AND 100000),
  duration_ms INTEGER NOT NULL CHECK (duration_ms BETWEEN 1 AND 28800000),
  PRIMARY KEY (tmdb_id, season, episode, duration_ms)
) WITHOUT ROWID, STRICT;
