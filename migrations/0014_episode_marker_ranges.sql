ALTER TABLE episode_intro_outro ADD COLUMN intro_start_ms INTEGER CHECK (
  intro_start_ms IS NULL OR (
    intro_start_ms >= 0 AND intro_end_ms IS NOT NULL AND intro_start_ms < intro_end_ms
  )
);

ALTER TABLE episode_intro_outro ADD COLUMN outro_end_ms INTEGER CHECK (
  outro_end_ms IS NULL OR (
    outro_start_ms IS NOT NULL AND outro_start_ms < outro_end_ms AND outro_end_ms <= 28800000
  )
);
