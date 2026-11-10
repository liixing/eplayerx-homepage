-- Keep reports without a known duration in episode_intro_outro.
CREATE TABLE episode_intro_outro_versions (
  tmdb_id INTEGER NOT NULL CHECK (tmdb_id BETWEEN 1 AND 2147483647),
  season INTEGER NOT NULL CHECK (season BETWEEN 0 AND 1000),
  episode INTEGER NOT NULL CHECK (episode BETWEEN 1 AND 100000),
  duration_ms INTEGER NOT NULL CHECK (duration_ms BETWEEN 1 AND 28800000),
  intro_end_ms INTEGER CHECK (intro_end_ms BETWEEN 1 AND 600000 AND intro_end_ms < duration_ms),
  outro_start_ms INTEGER CHECK (outro_start_ms BETWEEN 1 AND duration_ms - 1),
  intro_start_ms INTEGER CHECK (
    intro_start_ms IS NULL OR (
      intro_start_ms >= 0 AND intro_end_ms IS NOT NULL AND intro_start_ms < intro_end_ms
    )
  ),
  outro_end_ms INTEGER CHECK (
    outro_end_ms IS NULL OR (
      outro_start_ms IS NOT NULL AND outro_start_ms < outro_end_ms AND outro_end_ms <= duration_ms
    )
  ),
  PRIMARY KEY (tmdb_id, season, episode, duration_ms),
  CHECK (intro_end_ms IS NOT NULL OR outro_start_ms IS NOT NULL),
  CHECK (intro_end_ms < outro_start_ms)
) WITHOUT ROWID, STRICT;
