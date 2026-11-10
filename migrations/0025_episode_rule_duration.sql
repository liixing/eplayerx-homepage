-- Episode overrides are saved per video duration. Series/season defaults keep 0.
-- Existing episode overrides keep 0 and only apply when no duration version matches.
CREATE TABLE playback_timing_rules_new (
  tmdb_id INTEGER NOT NULL CHECK (tmdb_id BETWEEN 1 AND 2147483647),
  season INTEGER NOT NULL,
  episode INTEGER NOT NULL,
  intro_start_ms INTEGER CHECK (intro_start_ms >= 0),
  intro_end_ms INTEGER CHECK (intro_end_ms <= 600000),
  outro_start_ms INTEGER CHECK (outro_start_ms > 0),
  outro_end_ms INTEGER CHECK (outro_end_ms <= 28800000),
  ad_start_ms INTEGER CHECK (ad_start_ms >= 0),
  ad_end_ms INTEGER CHECK (ad_end_ms <= 28800000),
  no_ads INTEGER NOT NULL DEFAULT 0 CHECK (no_ads IN (0, 1)),
  duration_ms INTEGER NOT NULL DEFAULT 0 CHECK (duration_ms BETWEEN 0 AND 28800000),
  PRIMARY KEY (tmdb_id, season, episode, duration_ms),
  CHECK ((season = -1 AND episode = 0)
      OR (season BETWEEN 0 AND 1000 AND episode BETWEEN 0 AND 100000)),
  CHECK ((intro_start_ms IS NULL) = (intro_end_ms IS NULL) AND intro_start_ms < intro_end_ms),
  CHECK ((outro_start_ms IS NULL) = (outro_end_ms IS NULL) AND outro_start_ms < outro_end_ms),
  CHECK (intro_end_ms < outro_start_ms),
  CHECK ((ad_start_ms IS NULL) = (ad_end_ms IS NULL) AND ad_start_ms < ad_end_ms),
  CHECK (no_ads = 0 OR ad_start_ms IS NULL),
  CHECK (episode > 0 OR duration_ms = 0),
  CHECK (duration_ms = 0 OR (coalesce(intro_end_ms, 0) < duration_ms
      AND coalesce(outro_end_ms, 0) <= duration_ms AND coalesce(ad_end_ms, 0) <= duration_ms))
) WITHOUT ROWID, STRICT;

INSERT INTO playback_timing_rules_new SELECT *, 0 FROM playback_timing_rules;
DROP TABLE playback_timing_rules;
ALTER TABLE playback_timing_rules_new RENAME TO playback_timing_rules;
