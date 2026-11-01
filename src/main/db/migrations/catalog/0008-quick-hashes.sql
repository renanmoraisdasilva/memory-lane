CREATE TABLE quick_hashes (
  file_id INTEGER PRIMARY KEY,
  algorithm TEXT NOT NULL,
  digest TEXT NOT NULL,
  sample_bytes INTEGER NOT NULL CHECK (sample_bytes >= 0),
  file_size INTEGER NOT NULL CHECK (file_size >= 0),
  modified_at_fs TEXT,
  computed_at TEXT NOT NULL,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE INDEX idx_quick_hashes_digest ON quick_hashes(digest, file_size);
CREATE INDEX idx_files_size_state ON files(size, state);

UPDATE archive_identity SET schema_version = 8 WHERE id = 1;

CREATE TRIGGER clear_quick_hash_on_full_insert
AFTER INSERT ON hashes
WHEN NEW.status = 'complete'
BEGIN
  DELETE FROM quick_hashes WHERE file_id = NEW.file_id;
END;

CREATE TRIGGER clear_quick_hash_on_full_update
AFTER UPDATE OF status ON hashes
WHEN NEW.status = 'complete'
BEGIN
  DELETE FROM quick_hashes WHERE file_id = NEW.file_id;
END;
