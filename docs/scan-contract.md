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
2. **Extract metadata** - records filesystem facts, media classification, image
   dimensions where supported, video duration for MP4/MOV, and a
   filesystem-derived date.
3. **Generate thumbnails** - generates image/video thumbnails with Electron
   `nativeImage` into `.memorylane/cache/thumbs`.
4. **Calculate hashes** - streams SHA-256 in 1 MiB chunks and stores resumable
   hash records.

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

Moved candidates are counted and stored. Confirming them is a Phase 4 action;
source files are never moved or modified.

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

The current catalog schema version is 3. Opening an older catalog applies
pending migrations checksum-safely.

## Current limits

- ExifTool, ffprobe, ffmpeg, and Sharp are not wired yet. The current build uses
  dependency-free filesystem metadata, a small image-dimension reader, an
  ISO-BMFF duration reader for MP4/MOV, Electron native thumbnails, and Node
  SHA-256.
- Date resolution beyond filesystem timestamps is Phase 3.
- Hashing resumes at file granularity. A file interrupted mid-hash starts that
  file again; byte-offset resume is a later hardening step.
- Moved candidates have no confirmation UI or IPC yet.
- Duplicate groups, missing-file management, and validation are Phase 4.
