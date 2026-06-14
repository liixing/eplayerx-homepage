-- Reduce D1 read rows for public listing and homepage explore queries.
-- These partial indexes only cover rows that can appear in public responses.
-- Filter columns come first, followed by the ranking order used by SELECT.

CREATE INDEX IF NOT EXISTS idx_community_public_rank
  ON community_blocks (installs DESC, created_at DESC)
  WHERE hidden = 0;

CREATE INDEX IF NOT EXISTS idx_community_public_category_rank
  ON community_blocks (category, installs DESC, created_at DESC)
  WHERE hidden = 0;

CREATE INDEX IF NOT EXISTS idx_community_public_language_rank
  ON community_blocks (language, installs DESC, created_at DESC)
  WHERE hidden = 0;

CREATE INDEX IF NOT EXISTS idx_community_public_category_language_rank
  ON community_blocks (category, language, installs DESC, created_at DESC)
  WHERE hidden = 0;

CREATE INDEX IF NOT EXISTS idx_community_public_languages
  ON community_blocks (language)
  WHERE hidden = 0 AND language != '';

CREATE INDEX IF NOT EXISTS idx_block_collections_approved_rank
  ON block_collections (installs DESC, created_at DESC)
  WHERE status = 'approved';
