ALTER TABLE scan_sessions ADD COLUMN root_path TEXT;

ALTER TABLE scan_sessions ADD COLUMN intensity TEXT NOT NULL DEFAULT 'balanced'
  CHECK (intensity IN ('eco', 'balanced', 'max'));

ALTER TABLE scan_sessions ADD COLUMN error_message TEXT;

ALTER TABLE scan_sessions ADD COLUMN last_saved_at TEXT;

ALTER TABLE scan_sessions ADD COLUMN eta_seconds INTEGER;

ALTER TABLE scan_sessions ADD COLUMN new_files INTEGER NOT NULL DEFAULT 0;

ALTER TABLE scan_sessions ADD COLUMN changed_files INTEGER NOT NULL DEFAULT 0;

ALTER TABLE scan_sessions ADD COLUMN missing_files INTEGER NOT NULL DEFAULT 0;

ALTER TABLE scan_sessions ADD COLUMN moved_candidates INTEGER NOT NULL DEFAULT 0;

ALTER TABLE scan_stages ADD COLUMN updated_at TEXT;

CREATE INDEX idx_files_last_seen ON files(last_seen_at);

CREATE INDEX idx_files_missing_since ON files(missing_since);

CREATE INDEX idx_hashes_status ON hashes(status);

CREATE INDEX idx_cache_entries_kind_status ON cache_entries(kind, status);
