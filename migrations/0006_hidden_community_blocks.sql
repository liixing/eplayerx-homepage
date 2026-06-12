-- Collection-only charts (e.g. the Mon-Sun children of a weekday collection)
-- stay registered so collections can be (re)built anytime, but are hidden
-- from the public library: only the parent collection shows and installs.
ALTER TABLE community_blocks ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0;
