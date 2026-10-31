# Phase 3 scope - Dates

Status: implemented and verified.

Phase 3 makes dates honest. It adds ExifTool-based extraction, a deterministic
date-priority chain, suspicious-date handling, a Date unavailable workflow, and
catalog-only manual overrides.

## Exit criteria

- ExifTool reads image and video metadata in development and packaged builds.
- Dates resolve from EXIF/XMP/video metadata with filesystem fallback.
- Date precision, source, confidence, and original value are stored.
- Suspicious dates are not confidently placed in the timeline.
- Undated items appear in Date unavailable.
- A year or year/month can be assigned individually or in bulk.
- Manual overrides are catalog-only, reversible, and preserve the extracted date.
- The viewer can set and clear a manual date.
- Quality gates, E2E, packaging, and packaged smoke pass.

## Metadata extraction

**Primary:** `exiftool-vendored` 39.1.0 with ExifTool 13.60.

- Runs as a persistent child process with at most two processes.
- Uses group-prefixed reads so EXIF, XMP, QuickTime, RIFF, and Matroska dates are
  distinguishable.
- Reads with ExifTool's `-fast` default; metadata is normally at the start of
  the file.
- Extracts selected fields only:
  - date tags and provenance;
  - image dimensions and video duration;
  - camera make/model/lens;
  - GPS latitude/longitude/altitude;
  - video codec where available.
- Writes `metadata.exiftool = ok` or `failed` to `file_metadata`.
- Shuts down with `ScanService.shutdown()`.

**Fallbacks:** the existing dependency-free image-dimension reader and MP4/MOV
duration reader fill missing values. Filesystem timestamps remain the final
date fallback.

**Packaging:** `electron-builder.yml` unpacks
`node_modules/exiftool-vendored.*/**/*`. The packaged smoke writes EXIF to a
fixture JPEG and asserts that the packaged app resolves the EXIF date and records
`metadata.exiftool = ok`.

## Date priority

1. Manual catalog override.
2. EXIF `DateTimeOriginal`.
3. EXIF `CreateDate`.
4. EXIF `DateTimeDigitized`.
5. QuickTime creation/create dates.
6. RIFF/AVI dates.
7. Matroska dates.
8. XMP `CreateDate` / `DateCreated`.
9. Other ExifTool date tags from recognized video groups.
10. Filesystem creation date.
11. Filesystem modification date.

If a non-filesystem date is suspicious, it is not used and the item becomes
undated rather than falling back to a misleading filesystem date.

## Date storage

`file_dates` stores:

- `resolved_date` - sortable ISO-like wall-clock string, or UTC `Z` for
  filesystem dates;
- `precision` - `year`, `month`, or `exact`;
- `source`, `confidence`, `original_value`;
- `is_override`, `override_id`;
- `extracted_*` copies of the last non-manual resolution.

The extracted fields make overrides reversible. A rescan updates
`extracted_*` but does not overwrite an active manual override.

**Timezone policy:** EXIF wall-clock time is preserved. The app does not invent a
timezone when metadata has no offset. Original values are retained for audit.

## Suspicious dates

A date is flagged and skipped when:

- the year is before 1900;
- the year is more than one year in the future;
- the exact time is a known placeholder such as `1970-01-01 00:00:00` or
  `1980-01-01 00:00:00`.

Flagged values are stored as `date.suspicious` metadata. They are reviewed in
Date unavailable rather than placed confidently in the timeline.

## Contracts

New channels:

| Channel | Method | Params | Result |
|---|---|---|---|
| `library:get-undated` | `getLibraryUndated` | `{ cursor?, limit? }` | `LibraryUndatedPage` |
| `library:set-date` | `setLibraryDate` | `{ fileIds, year, month? }` | `{ updated }` |
| `library:clear-date` | `clearLibraryDate` | `{ fileIds }` | `{ updated }` |

`LibraryDate` now includes `isOverride`. Date assignment accepts year 1800-2200
and an optional month. Month assignment stores month precision; year assignment
stores year precision. No day is invented.

## UI

- New `/undated` route and sidebar destination with a count badge.
- Memory Lane summary links to Date unavailable when items need dates.
- Date unavailable lists undated media with selection, select-all-visible, and
  pagination.
- Assignment panel previews the catalog date before applying.
- Viewer Date section has **Set date** and, when applicable, **Clear manual
  date**.
- All mutations invalidate the library query family.

## Schema

Catalog migration 4:

- adds `file_dates.extracted_date`, `extracted_precision`, `extracted_source`,
  `extracted_confidence`, `extracted_original_value`;
- backfills them from existing non-override dates;
- adds an undated lookup index and a date-override active index.

Catalog schema version: 4.

## Testing

- Contract tests for new channels, params, and `isOverride`.
- Unit tests for date parsing, priority, fallback, and suspicious dates.
- ExifTool extraction tests with grouped tag fixtures.
- Real ExifTool integration test against a JPEG written with EXIF/GPS metadata.
- Repository tests for override set/clear, rescan preservation, and undated
  pagination.
- Renderer tests for Date unavailable assignment and viewer date dialog.
- E2E: scan a suspicious-date JPEG, assign July 2011, open the item, clear the
  override, and verify it returns to Date unavailable.
- Packaged smoke verifies ExifTool works after ASAR packaging.

## Known limits

- EXIF timezone offsets are preserved in metadata but not applied to the
  resolved wall-clock value.
- Date override history is stored in `date_overrides` but there is no history UI.
- Old camcorder metadata coverage depends on ExifTool and the container; files
  without dates remain undated.
- ExifTool does not add codec playback or thumbnails for unsupported video.
  Those need a separate ffmpeg decision.
- The manual 100,000-item performance check remains outstanding.
