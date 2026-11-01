CREATE TABLE archive_identity (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  catalog_id TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('source', 'destination_library', 'demoted_source')),
  previous_local_catalog_id TEXT,
  source_catalog_id TEXT,
  source_label TEXT,
  source_root_relative TEXT NOT NULL DEFAULT '',
  library_scope TEXT NOT NULL DEFAULT 'whole_catalog_root'
    CHECK (library_scope IN ('source_root', 'whole_catalog_root')),
  active_source_volume_id TEXT,
  promoted_at TEXT,
  demoted_at TEXT,
  last_indexed_at TEXT,
  created_at TEXT NOT NULL,
  schema_version INTEGER NOT NULL
);

INSERT INTO archive_identity (
  id,
  catalog_id,
  label,
  role,
  source_root_relative,
  library_scope,
  active_source_volume_id,
  created_at,
  schema_version
)
SELECT
  1,
  lower(hex(randomblob(16))),
  label,
  'source',
  '',
  'whole_catalog_root',
  volume_id,
  created_at,
  7
FROM drive_identity
WHERE id = 1;

ALTER TABLE files ADD COLUMN source_membership TEXT NOT NULL DEFAULT 'source'
  CHECK (source_membership IN ('source', 'local_only'));

ALTER TABLE files ADD COLUMN relative_path TEXT;

CREATE INDEX idx_files_source_membership ON files(source_membership);

ALTER TABLE hashes ADD COLUMN source_size_at_hash INTEGER;

ALTER TABLE hashes ADD COLUMN source_modified_at_fs_at_hash TEXT;

CREATE TABLE replica_destinations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  destination_id TEXT NOT NULL UNIQUE,
  volume_id TEXT NOT NULL,
  volume_serial TEXT,
  label TEXT NOT NULL,
  root_relative TEXT NOT NULL DEFAULT '',
  copy_root_relative TEXT,
  archive_folder_name TEXT,
  replica_goal TEXT NOT NULL CHECK (replica_goal IN ('extend_coverage', 'full_copy')),
  replica_layout TEXT NOT NULL DEFAULT 'dedicated'
    CHECK (replica_layout IN ('dedicated', 'mirror_source')),
  local_catalog_id TEXT,
  local_catalog_relative TEXT,
  source_index_relative TEXT,
  source_index_updated_at TEXT,
  allocation_mode TEXT NOT NULL DEFAULT 'all_safe'
    CHECK (allocation_mode IN ('all_safe', 'percent', 'fixed')),
  allocation_percent REAL,
  allocation_bytes INTEGER,
  reserve_bytes INTEGER NOT NULL,
  priority INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'retired', 'lost')),
  identity_confidence TEXT NOT NULL DEFAULT 'confirmed'
    CHECK (identity_confidence IN ('confirmed', 'probable', 'needs_confirmation')),
  full_copy_status TEXT NOT NULL DEFAULT 'not_applicable'
    CHECK (full_copy_status IN ('not_applicable', 'in_progress', 'complete', 'incomplete')),
  full_copy_shortfall_bytes INTEGER NOT NULL DEFAULT 0,
  full_copy_shortfall_files INTEGER NOT NULL DEFAULT 0,
  last_full_copy_check_at TEXT,
  last_seen_at TEXT,
  last_capacity_bytes INTEGER,
  last_free_bytes INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_replica_destinations_priority ON replica_destinations(priority);
CREATE INDEX idx_replica_destinations_status ON replica_destinations(status);
CREATE INDEX idx_replica_destinations_volume ON replica_destinations(volume_id);

CREATE TABLE replica_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  replica_id INTEGER NOT NULL,
  file_id INTEGER NOT NULL,
  relative_path TEXT NOT NULL,
  relative_path_key TEXT NOT NULL,
  source_relative_path TEXT NOT NULL,
  source_relative_path_key TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  sha256 TEXT,
  status TEXT NOT NULL CHECK (
    status IN ('discovered', 'copied', 'verified', 'stale', 'missing', 'conflict', 'failed')
  ),
  source_size_at_verify INTEGER,
  source_modified_at_fs_at_verify TEXT,
  destination_size_at_verify INTEGER,
  destination_modified_at_fs_at_verify TEXT,
  discovered_at TEXT,
  copied_at TEXT,
  verified_at TEXT,
  last_checked_at TEXT,
  last_error TEXT,
  UNIQUE (replica_id, file_id),
  UNIQUE (replica_id, relative_path_key),
  UNIQUE (replica_id, source_relative_path_key),
  FOREIGN KEY (replica_id) REFERENCES replica_destinations(id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  CHECK (status <> 'verified' OR sha256 IS NOT NULL)
);

CREATE INDEX idx_replica_files_file_status ON replica_files(file_id, status);
CREATE INDEX idx_replica_files_replica_status ON replica_files(replica_id, status);
CREATE INDEX idx_replica_files_replica_source_path
  ON replica_files(replica_id, source_relative_path_key);

CREATE TABLE replica_orphans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  replica_id INTEGER NOT NULL,
  relative_path TEXT NOT NULL,
  relative_path_key TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  sha256 TEXT,
  modified_at_fs TEXT,
  classification TEXT NOT NULL CHECK (
    classification IN ('extra', 'previously_in_source', 'ambiguous', 'unreadable')
  ),
  matched_source_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'missing')),
  discovered_at TEXT NOT NULL,
  last_checked_at TEXT,
  last_error TEXT,
  UNIQUE (replica_id, relative_path_key),
  FOREIGN KEY (replica_id) REFERENCES replica_destinations(id) ON DELETE CASCADE
);

CREATE INDEX idx_replica_orphans_replica_class
  ON replica_orphans(replica_id, classification, status);

CREATE TABLE replication_adoptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  destination_id INTEGER NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'idle' CHECK (
    status IN ('idle', 'scanning', 'hashing', 'paused', 'complete', 'failed', 'interrupted')
  ),
  started_at TEXT,
  finished_at TEXT,
  last_saved_at TEXT,
  scanned_files INTEGER NOT NULL DEFAULT 0,
  matched_files INTEGER NOT NULL DEFAULT 0,
  verified_files INTEGER NOT NULL DEFAULT 0,
  conflict_files INTEGER NOT NULL DEFAULT 0,
  stale_files INTEGER NOT NULL DEFAULT 0,
  ambiguous_files INTEGER NOT NULL DEFAULT 0,
  extra_files INTEGER NOT NULL DEFAULT 0,
  unreadable_files INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  FOREIGN KEY (destination_id) REFERENCES replica_destinations(id) ON DELETE CASCADE
);

INSERT INTO replication_adoptions (destination_id)
SELECT id FROM replica_destinations;

CREATE TABLE replication_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  status TEXT NOT NULL CHECK (
    status IN (
      'planned', 'running', 'paused', 'stopping', 'completed', 'stopped', 'failed', 'interrupted'
    )
  ),
  scope TEXT NOT NULL DEFAULT 'all_connected'
    CHECK (scope IN ('all_connected', 'full_copy_only', 'partial_only')),
  goal TEXT NOT NULL CHECK (goal IN ('extend_coverage', 'full_copy', 'both')),
  plan_revision INTEGER NOT NULL DEFAULT 1,
  plan_hash TEXT,
  plan_updated_at TEXT,
  started_at TEXT,
  finished_at TEXT,
  paused_at TEXT,
  resumed_at TEXT,
  stop_requested_at TEXT,
  last_heartbeat_at TEXT,
  destination_snapshot TEXT,
  planned_files INTEGER NOT NULL DEFAULT 0,
  planned_bytes INTEGER NOT NULL DEFAULT 0,
  copied_files INTEGER NOT NULL DEFAULT 0,
  copied_bytes INTEGER NOT NULL DEFAULT 0,
  verified_files INTEGER NOT NULL DEFAULT 0,
  verified_bytes INTEGER NOT NULL DEFAULT 0,
  failed_files INTEGER NOT NULL DEFAULT 0,
  failed_bytes INTEGER NOT NULL DEFAULT 0,
  stale_files INTEGER NOT NULL DEFAULT 0,
  stale_bytes INTEGER NOT NULL DEFAULT 0,
  remainder_files INTEGER NOT NULL DEFAULT 0,
  remainder_bytes INTEGER NOT NULL DEFAULT 0,
  full_copy_shortfall_files INTEGER NOT NULL DEFAULT 0,
  full_copy_shortfall_bytes INTEGER NOT NULL DEFAULT 0,
  destination_only_files INTEGER NOT NULL DEFAULT 0,
  destination_only_bytes INTEGER NOT NULL DEFAULT 0,
  source_missing_files INTEGER NOT NULL DEFAULT 0,
  source_missing_bytes INTEGER NOT NULL DEFAULT 0,
  replacement_peak_bytes INTEGER NOT NULL DEFAULT 0,
  reserve_breach_used INTEGER NOT NULL DEFAULT 0,
  promotion_id INTEGER,
  error_message TEXT,
  is_active INTEGER GENERATED ALWAYS AS (
    CASE WHEN status IN ('running', 'paused', 'stopping') THEN 1 ELSE NULL END
  ) VIRTUAL
);

CREATE UNIQUE INDEX idx_replication_runs_active
  ON replication_runs(is_active)
  WHERE is_active = 1;

CREATE INDEX idx_replication_runs_status ON replication_runs(status);
CREATE INDEX idx_replication_runs_started ON replication_runs(started_at DESC);

CREATE TABLE replication_run_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  at TEXT NOT NULL,
  type TEXT NOT NULL CHECK (
    type IN (
      'started', 'paused', 'resumed', 'stop_requested', 'plan_changed',
      'destination_added', 'completed', 'stopped', 'failed', 'interrupted'
    )
  ),
  plan_revision INTEGER,
  note TEXT,
  FOREIGN KEY (run_id) REFERENCES replication_runs(id) ON DELETE CASCADE
);

CREATE INDEX idx_replication_run_events_run ON replication_run_events(run_id, id);

CREATE TABLE source_promotions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  catalog_id TEXT NOT NULL,
  from_volume_id TEXT,
  to_volume_id TEXT,
  status TEXT NOT NULL CHECK (
    status IN ('planned', 'verifying', 'verified', 'completed', 'failed', 'rolled_back')
  ),
  started_at TEXT,
  completed_at TEXT,
  rolled_back_at TEXT,
  from_source_root_relative TEXT,
  to_source_root_relative TEXT,
  source_snapshot_path TEXT,
  destination_snapshot_path TEXT,
  verified_files INTEGER NOT NULL DEFAULT 0,
  verified_bytes INTEGER NOT NULL DEFAULT 0,
  shortfall_files INTEGER NOT NULL DEFAULT 0,
  shortfall_bytes INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);

CREATE INDEX idx_source_promotions_catalog ON source_promotions(catalog_id, id);
CREATE INDEX idx_source_promotions_status ON source_promotions(status);
