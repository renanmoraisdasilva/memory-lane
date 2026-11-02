ALTER TABLE missing_files ADD COLUMN dismissed_at TEXT;

CREATE INDEX idx_missing_files_dismissed_at ON missing_files(dismissed_at);

UPDATE archive_identity SET schema_version = 10 WHERE id = 1;
