DROP TABLE IF EXISTS backup_destinations;

CREATE TABLE replication_destination_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  destination_id TEXT NOT NULL UNIQUE,
  volume_id TEXT NOT NULL,
  catalog_id TEXT NOT NULL,
  label TEXT NOT NULL,
  root_relative TEXT NOT NULL DEFAULT '',
  last_seen_at TEXT NOT NULL,
  last_status TEXT
);

CREATE INDEX idx_replication_destination_cache_volume
  ON replication_destination_cache(volume_id);

CREATE INDEX idx_replication_destination_cache_seen
  ON replication_destination_cache(last_seen_at DESC);
