-- iOS shared homepages are public immediately and can carry optional attribution
-- plus a generated preview image endpoint for cards / social previews.
ALTER TABLE block_collections ADD COLUMN author_name TEXT;
ALTER TABLE block_collections ADD COLUMN preview_image_url TEXT;
