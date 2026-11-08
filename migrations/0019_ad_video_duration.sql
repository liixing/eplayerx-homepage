CREATE TABLE screen_ad_segments_new (
  tmdb_id INTEGER NOT NULL CHECK (tmdb_id BETWEEN 1 AND 2147483647),
  season INTEGER NOT NULL CHECK (season BETWEEN 0 AND 1000),
  episode INTEGER NOT NULL CHECK (episode BETWEEN 1 AND 100000),
  start_ms INTEGER NOT NULL CHECK (start_ms >= 0),
  end_ms INTEGER NOT NULL CHECK (end_ms <= 28800000),
  duration_ms INTEGER NOT NULL DEFAULT 0 CHECK (duration_ms BETWEEN 0 AND 28800000),
  PRIMARY KEY (tmdb_id, season, episode, duration_ms) ON CONFLICT IGNORE,
  CHECK (end_ms - start_ms BETWEEN 3000 AND 90000),
  CHECK (duration_ms = 0 OR end_ms < duration_ms)
) WITHOUT ROWID, STRICT;

-- Keep legacy reports for reference, but their unknown duration cannot match a video.
INSERT INTO screen_ad_segments_new (tmdb_id, season, episode, start_ms, end_ms)
SELECT tmdb_id, season, episode, start_ms, end_ms FROM screen_ad_segments;

DROP TABLE screen_ad_segments;
ALTER TABLE screen_ad_segments_new RENAME TO screen_ad_segments;
