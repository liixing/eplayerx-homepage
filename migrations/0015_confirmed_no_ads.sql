-- Rows are added by the server operator after confirming an episode has no ads.
CREATE TABLE screen_ad_free_episodes (
  tmdb_id INTEGER NOT NULL CHECK (tmdb_id BETWEEN 1 AND 2147483647),
  season INTEGER NOT NULL CHECK (season BETWEEN 0 AND 1000),
  episode INTEGER NOT NULL CHECK (episode BETWEEN 1 AND 100000),
  PRIMARY KEY (tmdb_id, season, episode)
) WITHOUT ROWID, STRICT;
