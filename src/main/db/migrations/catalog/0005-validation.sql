ALTER TABLE validation_sessions ADD COLUMN total INTEGER NOT NULL DEFAULT 0;

ALTER TABLE validation_sessions ADD COLUMN processed INTEGER NOT NULL DEFAULT 0;

ALTER TABLE validation_sessions ADD COLUMN current_level TEXT;

ALTER TABLE validation_sessions ADD COLUMN error_message TEXT;

ALTER TABLE validation_sessions ADD COLUMN last_saved_at TEXT;

ALTER TABLE validation_results ADD COLUMN level TEXT;

CREATE UNIQUE INDEX idx_validation_results_unique
  ON validation_results(session_id, file_id, level);

CREATE INDEX idx_validation_results_level
  ON validation_results(session_id, level);
