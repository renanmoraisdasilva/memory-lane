ALTER TABLE files ADD COLUMN link_count INTEGER NOT NULL DEFAULT 1;

CREATE TABLE cleanup_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  status TEXT NOT NULL CHECK (status IN ('running', 'complete', 'cancelled', 'failed')),
  keeper_rule TEXT NOT NULL,
  root_path TEXT NOT NULL,
  quarantine_path TEXT NOT NULL,
  journal_path TEXT NOT NULL,
  groups_total INTEGER NOT NULL DEFAULT 0,
  groups_processed INTEGER NOT NULL DEFAULT 0,
  groups_skipped INTEGER NOT NULL DEFAULT 0,
  files_total INTEGER NOT NULL DEFAULT 0,
  files_moved INTEGER NOT NULL DEFAULT 0,
  files_skipped INTEGER NOT NULL DEFAULT 0,
  bytes_total INTEGER NOT NULL DEFAULT 0,
  bytes_moved INTEGER NOT NULL DEFAULT 0,
  current_path TEXT,
  error_message TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE INDEX idx_cleanup_runs_started ON cleanup_runs(started_at DESC);

CREATE TABLE cleanup_moves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  file_id INTEGER NOT NULL,
  source_path TEXT NOT NULL,
  quarantine_path TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at_fs TEXT,
  modified_at_fs TEXT,
  keeper_file_id INTEGER NOT NULL,
  keeper_path TEXT NOT NULL,
  moved_at TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES cleanup_runs(id) ON DELETE CASCADE
);

CREATE INDEX idx_cleanup_moves_run ON cleanup_moves(run_id);
CREATE INDEX idx_cleanup_moves_file ON cleanup_moves(file_id);

UPDATE archive_identity SET schema_version = 11 WHERE id = 1;
