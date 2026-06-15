-- Make D1 hot public reads match ordinary composite indexes as well as the
-- existing partial indexes. This keeps query planning predictable for the
-- frequently requested language menu and approved homepage list.

CREATE INDEX IF NOT EXISTS idx_community_hidden_language
  ON community_blocks (hidden, language);

CREATE INDEX IF NOT EXISTS idx_community_hidden_rank
  ON community_blocks (hidden, installs DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_block_collections_status_rank
  ON block_collections (status, installs DESC, created_at DESC);
