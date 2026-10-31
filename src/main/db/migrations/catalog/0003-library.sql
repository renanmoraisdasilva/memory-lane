ALTER TABLE files ADD COLUMN width INTEGER;

ALTER TABLE files ADD COLUMN height INTEGER;

ALTER TABLE files ADD COLUMN duration_seconds REAL;

UPDATE files
SET width = (
  SELECT CAST(value AS INTEGER)
  FROM file_metadata
  WHERE file_id = files.id AND key = 'media.width'
  LIMIT 1
)
WHERE width IS NULL
  AND EXISTS (
    SELECT 1 FROM file_metadata
    WHERE file_id = files.id AND key = 'media.width'
  );

UPDATE files
SET height = (
  SELECT CAST(value AS INTEGER)
  FROM file_metadata
  WHERE file_id = files.id AND key = 'media.height'
  LIMIT 1
)
WHERE height IS NULL
  AND EXISTS (
    SELECT 1 FROM file_metadata
    WHERE file_id = files.id AND key = 'media.height'
  );

CREATE INDEX idx_file_dates_timeline ON file_dates(resolved_date DESC, file_id DESC);
