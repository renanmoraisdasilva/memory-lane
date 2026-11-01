CREATE TABLE cache_entries_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('thumbnail', 'preview', 'poster', 'proxy')),
  path TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  source_size INTEGER,
  source_modified_at_fs TEXT,
  generated_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('pending', 'ready', 'failed')),
  error_message TEXT,
  UNIQUE (file_id, kind),
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

INSERT INTO cache_entries_new (
  id, file_id, kind, path, bytes, generated_at, status
)
SELECT id, file_id, kind, path, bytes, generated_at, status
FROM cache_entries;

DROP TABLE cache_entries;
ALTER TABLE cache_entries_new RENAME TO cache_entries;

CREATE INDEX idx_cache_entries_status ON cache_entries(status);

UPDATE archive_identity SET schema_version = 9 WHERE id = 1;
