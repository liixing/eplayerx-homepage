-- Output language of each community block (from the submission), so the
-- client browser can filter by language.
ALTER TABLE community_blocks ADD COLUMN language TEXT NOT NULL DEFAULT '';
