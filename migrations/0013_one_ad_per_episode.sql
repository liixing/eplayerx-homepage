CREATE TABLE screen_ad_segments_new (
  tmdb_id INTEGER NOT NULL CHECK (tmdb_id BETWEEN 1 AND 2147483647),
  season INTEGER NOT NULL CHECK (season BETWEEN 0 AND 1000),
  episode INTEGER NOT NULL CHECK (episode BETWEEN 1 AND 100000),
  start_ms INTEGER NOT NULL CHECK (start_ms >= 0),
  end_ms INTEGER NOT NULL CHECK (end_ms <= 28800000),
  PRIMARY KEY (tmdb_id, season, episode) ON CONFLICT IGNORE,
  CHECK (end_ms - start_ms BETWEEN 3000 AND 90000)
) WITHOUT ROWID, STRICT;

-- Discard the four flagged timings for 后会友期 S01E01 before keeping one per episode.
INSERT INTO screen_ad_segments_new (tmdb_id, season, episode, start_ms, end_ms)
SELECT tmdb_id, season, episode, start_ms, end_ms
FROM screen_ad_segments
WHERE NOT (
  tmdb_id = 338938 AND season = 1 AND episode = 1
  AND start_ms IN (123580, 134780, 231020, 246020)
)
ORDER BY tmdb_id, season, episode, start_ms;

DROP TABLE screen_ad_segments;
ALTER TABLE screen_ad_segments_new RENAME TO screen_ad_segments;
