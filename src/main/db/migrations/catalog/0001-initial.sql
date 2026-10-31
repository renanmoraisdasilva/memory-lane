CREATE TABLE drive_identity (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  volume_id TEXT NOT NULL UNIQUE,
  volume_serial TEXT,
  label TEXT NOT NULL,
  file_system TEXT NOT NULL,
  catalog_schema INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE catalog_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE scan_roots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE scan_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  state TEXT NOT NULL CHECK (state IN ('running', 'paused', 'interrupted', 'complete')),
  mode TEXT NOT NULL CHECK (mode IN ('initial', 'incremental')),
  last_stage TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE scan_stages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('catalog', 'metadata', 'thumbnails', 'hashes')),
  state TEXT NOT NULL CHECK (state IN ('queued', 'running', 'paused', 'complete', 'failed')),
  processed INTEGER NOT NULL DEFAULT 0,
  total INTEGER,
  started_at TEXT,
  finished_at TEXT,
  UNIQUE (session_id, stage),
  FOREIGN KEY (session_id) REFERENCES scan_sessions(id) ON DELETE CASCADE
);

CREATE TABLE files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL COLLATE NOCASE UNIQUE,
  name TEXT NOT NULL,
  extension TEXT,
  size INTEGER NOT NULL,
  created_at_fs TEXT,
  modified_at_fs TEXT,
  media_class TEXT NOT NULL DEFAULT 'other',
  format TEXT,
  mime TEXT,
  state TEXT NOT NULL DEFAULT 'present' CHECK (state IN ('present', 'missing')),
  missing_since TEXT,
  last_seen_at TEXT NOT NULL
);

CREATE INDEX idx_files_media_class ON files(media_class);
CREATE INDEX idx_files_state ON files(state);
CREATE INDEX idx_files_modified_at ON files(modified_at_fs DESC);
CREATE INDEX idx_files_name ON files(name COLLATE NOCASE);

CREATE TABLE file_metadata (
  file_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  source TEXT,
  extracted_at TEXT NOT NULL,
  PRIMARY KEY (file_id, key, source),
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE INDEX idx_file_metadata_key ON file_metadata(key);

CREATE TABLE file_dates (
  file_id INTEGER PRIMARY KEY,
  resolved_date TEXT,
  precision TEXT CHECK (precision IN ('year', 'month', 'exact')),
  source TEXT,
  confidence REAL,
  original_value TEXT,
  is_override INTEGER NOT NULL DEFAULT 0,
  override_id INTEGER,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE INDEX idx_file_dates_resolved ON file_dates(resolved_date);
CREATE INDEX idx_file_dates_precision ON file_dates(precision);

CREATE TABLE date_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL,
  year INTEGER NOT NULL CHECK (year BETWEEN 1800 AND 2200),
  month INTEGER CHECK (month BETWEEN 1 AND 12),
  created_at TEXT NOT NULL,
  reverted_at TEXT,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE INDEX idx_date_overrides_file ON date_overrides(file_id, created_at DESC);

CREATE TABLE hashes (
  file_id INTEGER PRIMARY KEY,
  sha256 TEXT NOT NULL,
  hashed_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'complete' CHECK (status IN ('pending', 'complete', 'failed')),
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE INDEX idx_hashes_sha256 ON hashes(sha256);

CREATE TABLE duplicate_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sha256 TEXT NOT NULL UNIQUE,
  file_count INTEGER NOT NULL,
  total_bytes INTEGER NOT NULL
);

CREATE TABLE duplicate_members (
  group_id INTEGER NOT NULL,
  file_id INTEGER NOT NULL UNIQUE,
  PRIMARY KEY (group_id, file_id),
  FOREIGN KEY (group_id) REFERENCES duplicate_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE INDEX idx_duplicate_members_group ON duplicate_members(group_id);

CREATE TABLE missing_files (
  file_id INTEGER PRIMARY KEY,
  last_path TEXT NOT NULL,
  last_seen_at TEXT,
  reason TEXT,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE TABLE moved_candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL,
  old_path TEXT NOT NULL,
  new_path TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'confirmed', 'dismissed')),
  confirmed_at TEXT,
  UNIQUE (file_id, new_path),
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE INDEX idx_moved_candidates_state ON moved_candidates(state);

CREATE TABLE validation_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  levels TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('running', 'paused', 'complete', 'failed')),
  started_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE TABLE validation_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  file_id INTEGER,
  result TEXT NOT NULL,
  detail TEXT,
  FOREIGN KEY (session_id) REFERENCES validation_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE SET NULL
);

CREATE INDEX idx_validation_results_session ON validation_results(session_id);
CREATE INDEX idx_validation_results_result ON validation_results(result);

CREATE TABLE cache_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('thumbnail', 'preview', 'poster')),
  path TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  generated_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('pending', 'ready', 'failed')),
  UNIQUE (file_id, kind),
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE INDEX idx_cache_entries_status ON cache_entries(status);
