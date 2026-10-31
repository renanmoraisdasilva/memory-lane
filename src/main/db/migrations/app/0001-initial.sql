CREATE TABLE app_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE registered_drives (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  volume_id TEXT NOT NULL UNIQUE,
  volume_serial TEXT,
  label TEXT NOT NULL,
  file_system TEXT NOT NULL,
  root_path TEXT NOT NULL,
  last_letter TEXT,
  last_seen_at TEXT NOT NULL,
  catalog_schema INTEGER NOT NULL DEFAULT 0,
  last_backup_at TEXT
);

CREATE INDEX idx_registered_drives_last_seen
  ON registered_drives(last_seen_at DESC);

CREATE TABLE backup_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  drive_volume_id TEXT NOT NULL,
  path TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  FOREIGN KEY (drive_volume_id) REFERENCES registered_drives(volume_id) ON DELETE CASCADE
);

CREATE INDEX idx_backup_history_drive
  ON backup_history(drive_volume_id, created_at DESC);

CREATE TABLE backup_destinations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  volume_id TEXT NOT NULL UNIQUE,
  label TEXT,
  last_seen_at TEXT
);
