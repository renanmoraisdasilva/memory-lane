# 0005 - Versioned metadata extraction

- Status: Accepted
- Date: 2026-10-31

## Context

Metadata extraction gained new fields over time, including video frame rate.
Incremental scans intentionally skip files that already have a `scan.metadata`
marker, so existing catalogs would keep old metadata indefinitely. Users had no
way to know that a new field was missing, and a full manual metadata
revalidation could be expensive and hard to discover.

## Decision

- Define a shared `METADATA_EXTRACTOR_VERSION` constant.
- On every successful metadata extraction, write the current version to
  `file_metadata` as `scan.metadataVersion`.
- Treat a file as pending metadata when it has no `scan.metadata` marker or its
  version is below the current extractor version.
- Include `metadataRefreshCount` in `LibrarySummary`.
- Show a persistent **Metadata refresh available** banner in Memory Lane when
  stale files exist, with a link to Scan & processing.
- Refresh metadata with the next incremental scan. No separate whole-catalog
  job is required.
- Preserve manual date overrides during refresh, as normal metadata saves
  already do.
- Leave the catalog schema unchanged; the version is a metadata row, not a new
  column.

## Alternatives

- **Add a `files.metadata_version` column and migration.** Faster queries, but
  another schema version for a value that is naturally metadata.
- **Re-extract every file automatically on upgrade.** No user action, but it can
  consume hours of CPU and ExifTool work on a large archive.
- **Force a full rescan.** Wider work than needed and risks unnecessary
  thumbnail/hash churn.
- **Track a version per field or feature.** More precise, but much more state
  and UI complexity than v0.1 needs.
- **Only show a per-viewer "not recorded" label.** Does not explain why the
  field is missing or how to refresh the catalog.

## Consequences

- Existing catalogs show the refresh banner until the next successful scan
  extracts their metadata at the current version.
- The pending-metadata and summary queries read `file_metadata`; the existing
  `(file_id, key, source)` primary key keeps this indexed.
- Failed extractions remain stale and are retried by the next scan.
- Future metadata additions only need a version bump and normal scan; the UI and
  refresh behavior already exist.
