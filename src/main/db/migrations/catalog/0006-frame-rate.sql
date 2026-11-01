ALTER TABLE files ADD COLUMN frame_rate REAL;

UPDATE files
SET frame_rate = (
  SELECT CAST(value AS REAL)
  FROM file_metadata
  WHERE file_id = files.id AND key = 'media.frameRate'
  LIMIT 1
)
WHERE frame_rate IS NULL
  AND EXISTS (
    SELECT 1 FROM file_metadata
    WHERE file_id = files.id AND key = 'media.frameRate'
  );
