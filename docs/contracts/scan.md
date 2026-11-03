# Scan contract

Status: current. The TypeScript and Zod definitions live in
`src/shared/contracts/scan.ts`, `src/shared/contracts/channels.ts`, and
`src/preload/index.ts`.

## Channels and API

| Channel | API method | Params | Result |
|---|---|---|---|
| `scan:get-state` | `getScanState` | `{ volumeId }` | `ScanState` |
| `scan:start` | `startScan` | `{ volumeId, intensity? }` | `ScanState` |
| `scan:pause` | `pauseScan` | `{ volumeId }` | `ScanState` |
| `scan:resume` | `resumeScan` | `{ volumeId }` | `ScanState` |
| `scan:set-intensity` | `setScanIntensity` | `{ volumeId, intensity }` | `ScanState` |
| `drives:confirm-identity` | `confirmDriveIdentity` | `{ volumeId }` | `void` |

`drives:confirm-identity` updates the app registry's last letter and root path
after the user accepts a changed drive letter. It does not open the catalog; the
normal `openCatalog` call still validates the catalog's volume identity.

A catalog must be open before any scan method is called. There are no push
events; the renderer polls `getScanState` roughly once per second while a scan is
active.

## State shape

```ts
type ScanStatus = "idle" | "active" | "paused" | "interrupted" | "complete" | "error";
type ScanMode = "initial" | "incremental";
type ScanStageId = "catalog" | "metadata" | "thumbnails" | "hashes";
type ScanStageState = "queued" | "active" | "complete" | "paused" | "failed";
type ScanIntensity = "eco" | "balanced" | "max";

interface ScanStage {
  id: ScanStageId;
  state: ScanStageState;
  processed: number;
  total: number | null;
}

interface ScanReport {
  newFiles: number;
  changedFiles: number;
  missingFiles: number;
  movedCandidates: number;
}

interface ScanState {
  driveLabel: string;
  volumeId: VolumeId;
  status: ScanStatus;
  mode: ScanMode;
  stages: ScanStage[]; // exactly four, in catalog/metadata/thumbnails/hashes order
  currentStage: ScanStageId | null;
  startedAt: string | null;
  finishedAt: string | null;
  lastSavedAt: string | null;
  etaSeconds: number | null;
  intensity: ScanIntensity;
  report: ScanReport | null;
  errorMessage: string | null;
}
```

Contract notes:

- `getScanState` returns `idle` with four queued stages before the first scan.
- `report` is non-null only when `status === "complete"`.
- `errorMessage` is null except in the `error` state.
- `currentStage` is null for idle and complete.
- `total` can be null while the catalog stage is discovering files.
- `status: "error"` is used for a disconnected or unavailable drive.
- `interrupted` means the app closed or the operation stopped; resume is always
  explicit.

## Stage behavior

The coordinator runs stages in this order:

1. **Catalog files** - enumerates the drive root, writes `files`, detects
   new/changed/reappearing files, and marks missing files after enumeration.
2. **Extract metadata** - records filesystem facts, media classification, and
   selected ExifTool tags for dates, dimensions, duration, frame rate, camera,
   codec, and GPS. The dependency-free readers fill missing dimensions or
   MP4/MOV duration; when no usable embedded date exists, the date priority
   chain uses the older of filesystem created and modified, ignoring placeholder
   dates. Successful extraction writes `scan.metadataVersion` with the current
   `METADATA_EXTRACTOR_VERSION`.
3. **Generate thumbnails** - generates image/video thumbnails with Electron
   `nativeImage` into `.memorylane/cache/thumbs`.
4. **Calculate hashes** - streams SHA-256 in 1 MiB chunks and stores resumable
   hash records. Large files without a same-size peer use a sampled quick
   fingerprint instead; they are fully hashed when a duplicate or moved-file
   candidate appears or when replication/validation needs a full source hash.

The quick fingerprint reads the first, middle, and last 1 MiB of files larger
than 64 MiB. It is a resume marker and candidate filter, never a substitute for
a full SHA-256. Full hashes from older catalogs are preserved. A file with a
valid quick fingerprint is skipped until it changes or a same-size peer appears.
When a full hash is stored, the quick fingerprint is removed.

Pause completes the current file or batch, persists progress, and stops
scheduling new work. Resume continues from the saved per-stage progress. App
close marks a running session interrupted before the database worker is closed.

Intensity maps to worker concurrency: Eco 2, Balanced 4, Max 8. It is persisted
in catalog settings and on the scan session.

Visible library thumbnails use the interactive queue and preempt bulk scan
thumbnails. The shared scheduler deduplicates in-flight work per file.

## Report semantics

- `newFiles`: paths discovered for the first time in this session.
- `changedFiles`: existing files whose size or modified time changed, or a
  missing file that reappeared.
- `missingFiles`: previously cataloged present files under the scan root that
  were not seen in this session.
- `movedCandidates`: missing files whose SHA-256 matches a present file first
  seen in this session.

Moved candidates are counted and stored. Confirming them is a Phase 4 action.
Scan never moves or modifies source files; the only source-moving operation is
the confirmed duplicate quarantine mover.

## Additive drive fields

`DriveInfo` includes optional fields for the drive gate:

```ts
isConnected?: boolean;
lastLetter?: string | null;
lastScanAt?: string | null;
indexedFiles?: number;
requiresLetterConfirmation?: boolean;
```

`listDrives` returns connected drives first and previously registered offline
drives after them. An offline drive has `isConnected: false` and
`catalogStatus: "registered"`. `requiresLetterConfirmation` is true when the
current drive letter differs from the last registered letter.

## Persistence

- App migration 2 adds `last_scan_at` and `indexed_files` to `registered_drives`.
- Catalog migration 2 adds scan progress counters, intensity, root path, error
  message, last-saved time, ETA, and moved-candidate count.
- Catalog migration 3 adds media dimensions, video duration, and the timeline
  index.
- Catalog migration 4 adds reversible extracted-date fields and undated lookup
  indexes.
- Catalog migration 5 adds validation progress and per-result levels.
- Catalog migration 6 adds the `files.frame_rate` video fact and backfills it
  from existing `media.frameRate` metadata entries.
- Catalog migration 7 adds archive identity, replica destinations and files,
  adoption/run/promotion records, and queue/coverage indexes.
- Catalog migration 8 adds `quick_hashes` for sampled large-file fingerprints,
  a size/state index for pending-hash selection, and triggers that clear a
  quick hash when a full hash is saved.
- Catalog migration 9 extends cache entries with compatible video-proxy rows and
  source fingerprints.

The current catalog schema version is 12. Opening an older catalog applies
pending migrations checksum-safely. A catalog upgraded from schema 6 receives a
stable archive identity and defaults existing files to `source` membership.
Existing full SHA-256 hashes remain valid; migration 8 does not rehash them.

Metadata has its own extractor version independent of the catalog schema.
Files below `METADATA_EXTRACTOR_VERSION` are treated as pending by the metadata
stage, so the next incremental scan refreshes them without re-extracting files
that are already current. The library summary exposes the stale count and
Memory Lane links to Scan & processing when a refresh is available.

## Current limits

- ExifTool 13.60 runs through `exiftool-vendored` with at most two child
  processes. ffprobe/ffmpeg and Sharp are not wired yet.
- The dependency-free image-dimension and MP4/MOV duration readers remain as
  fallbacks. Electron native thumbnails and Node SHA-256 are unchanged.
- Date resolution uses EXIF/XMP/video tags first. Without a usable embedded
  date, it uses the older of filesystem created and modified, ignoring
  1970/1980 placeholder dates and future dates. Suspicious metadata dates leave
  the item undated instead of falling back to a misleading filesystem date.
- Hashing resumes at file granularity. A file interrupted mid-hash starts that
  file again; byte-offset resume is a later hardening step.
- Moved candidates, duplicate groups, missing-file management, and validation are
  implemented in Library health (Phase 4).
