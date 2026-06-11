-- Shared homepages (block_collections) now require admin review before the
-- import link goes live. Rows created before this migration were published
-- without review, so the column defaults to 'approved' to keep them working.
ALTER TABLE block_collections ADD COLUMN status TEXT NOT NULL DEFAULT 'approved';
