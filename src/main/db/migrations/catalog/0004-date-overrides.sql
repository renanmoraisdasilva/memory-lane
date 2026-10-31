ALTER TABLE file_dates ADD COLUMN extracted_date TEXT;

ALTER TABLE file_dates ADD COLUMN extracted_precision TEXT;

ALTER TABLE file_dates ADD COLUMN extracted_source TEXT;

ALTER TABLE file_dates ADD COLUMN extracted_confidence REAL;

ALTER TABLE file_dates ADD COLUMN extracted_original_value TEXT;

UPDATE file_dates
SET extracted_date = resolved_date,
    extracted_precision = precision,
    extracted_source = source,
    extracted_confidence = confidence,
    extracted_original_value = original_value
WHERE extracted_date IS NULL
  AND is_override = 0;

CREATE INDEX idx_file_dates_undated ON file_dates(file_id) WHERE resolved_date IS NULL;

CREATE INDEX idx_date_overrides_active ON date_overrides(file_id, reverted_at);
