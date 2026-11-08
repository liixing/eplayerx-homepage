CREATE TABLE screen_ad_series (
  tmdb_id INTEGER PRIMARY KEY CHECK (tmdb_id BETWEEN 1 AND 2147483647),
  eligible INTEGER NOT NULL CHECK (eligible IN (0, 1)),
  expires_at INTEGER NOT NULL CHECK (expires_at > 0)
) STRICT;

CREATE TABLE screen_ad_segments (
  tmdb_id INTEGER NOT NULL CHECK (tmdb_id BETWEEN 1 AND 2147483647),
  season INTEGER NOT NULL CHECK (season BETWEEN 0 AND 1000),
  episode INTEGER NOT NULL CHECK (episode BETWEEN 1 AND 100000),
  start_ms INTEGER NOT NULL CHECK (start_ms >= 0),
  end_ms INTEGER NOT NULL CHECK (end_ms <= 28800000),
  PRIMARY KEY (tmdb_id, season, episode, start_ms),
  CHECK (end_ms - start_ms BETWEEN 3000 AND 90000)
) WITHOUT ROWID, STRICT;

CREATE TABLE episode_intro_outro (
  tmdb_id INTEGER NOT NULL CHECK (tmdb_id BETWEEN 1 AND 2147483647),
  season INTEGER NOT NULL CHECK (season BETWEEN 0 AND 1000),
  episode INTEGER NOT NULL CHECK (episode BETWEEN 1 AND 100000),
  intro_end_ms INTEGER CHECK (intro_end_ms BETWEEN 1 AND 600000),
  outro_start_ms INTEGER CHECK (outro_start_ms BETWEEN 1 AND 28800000),
  PRIMARY KEY (tmdb_id, season, episode),
  CHECK (intro_end_ms IS NOT NULL OR outro_start_ms IS NOT NULL),
  CHECK (intro_end_ms < outro_start_ms)
) WITHOUT ROWID, STRICT;
