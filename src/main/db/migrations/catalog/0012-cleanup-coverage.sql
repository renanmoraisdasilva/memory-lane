ALTER TABLE cleanup_runs
  ADD COLUMN groups_without_coverage INTEGER NOT NULL DEFAULT 0;

UPDATE archive_identity SET schema_version = 12 WHERE id = 1;
