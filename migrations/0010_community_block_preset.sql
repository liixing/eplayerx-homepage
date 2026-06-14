-- Denormalize the block preset so collection filtering can use an index
-- instead of scanning block_json with a leading-wildcard LIKE.

ALTER TABLE community_blocks ADD COLUMN preset TEXT NOT NULL DEFAULT '';

UPDATE community_blocks
SET preset = COALESCE(json_extract(block_json, '$.preset'), '')
WHERE preset = '';

CREATE INDEX IF NOT EXISTS idx_community_public_preset_rank
  ON community_blocks (preset, installs DESC, created_at DESC)
  WHERE hidden = 0;
