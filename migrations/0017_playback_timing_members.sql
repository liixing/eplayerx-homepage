CREATE TABLE timing_admin_members (
  email TEXT PRIMARY KEY,
  invited_at INTEGER NOT NULL DEFAULT (unixepoch()),
  joined_at INTEGER
) WITHOUT ROWID, STRICT;

CREATE TABLE timing_admin_audit (
  id INTEGER PRIMARY KEY,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('invite', 'remove', 'save')),
  subject TEXT NOT NULL,
  details TEXT CHECK (details IS NULL OR json_valid(details)),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
) STRICT;
