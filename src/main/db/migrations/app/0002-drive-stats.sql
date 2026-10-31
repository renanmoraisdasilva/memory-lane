ALTER TABLE registered_drives ADD COLUMN last_scan_at TEXT;

ALTER TABLE registered_drives ADD COLUMN indexed_files INTEGER NOT NULL DEFAULT 0;
