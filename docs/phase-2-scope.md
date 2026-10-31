# Phase 2 scope — Memory Lane and viewer

Status: scoped, not implemented.

Phase 1 is integrated on `main`. Phase 2 adds the first real media browsing
experience: a chronological library, a virtualized photo/video grid, lazy
viewport-priority thumbnails, and a combined photo/video viewer.

## Exit criteria

Phase 2 is done when:

- a catalog with photos and videos opens in Memory Lane;
- the timeline scrolls smoothly with a large catalog while thumbnails generate;
- filters and density changes work without losing the current place;
- a photo or video opens in one viewer, with metadata, previous/next, reveal,
  and external-open actions;
- missing, unsupported, disconnected, loading, and empty states are explicit;
- scanning can run while browsing, and visible thumbnails are prioritized over
  bulk scan thumbnails;
- no original file is moved, renamed, edited, or deleted;
- quality gates, E2E, and packaged smoke pass.

## In scope

### 1. Memory Lane page

Route: `/library`.

- Header: Memory Lane, item count, indexed size, last scan, read-only marker.
- Filters: All / Photos / Videos.
- Density: Comfortable / Dense.
- Year chips and previous/next month navigation.
- Date-grouped sections: day, month, or year according to date precision.
- Virtualized grid with lazy thumbnails.
- Tile content:
  - thumbnail, or skeleton while it loads;
  - video duration and play glyph when duration is known;
  - filename and size on hover/focus;
  - missing badge for missing files.
- States:
  - populated timeline;
  - empty filter result;
  - catalog with no media;
  - thumbnail pending/failed;
  - missing file;
  - drive/catalog unavailable with reconnect/retry.
- A trailing Date unavailable section when items have no resolved date. It is
  informational only; the Date unavailable screen and date assignment are
  Phase 3.

Explicitly absent in Phase 2:

- selection checkboxes and bulk date assignment;
- duplicate badges and duplicate sections;
- ratings, favorites, collections, tags, search;
- folder-name date inference;
- cleanup, delete, move, rename, or any source write.

### 2. Media viewer

Routes:

- `/library/item/:fileId` for all files;
- preserve the active filter in the query string, e.g.
  `/library/item/42?filter=photos`.

Layout:

- back to Memory Lane;
- filename and position (`1,482 of 3,920`);
- previous/next;
- media stage;
- details panel.

Photo:

- fit / 100%;
- previous/next;
- no rotate, crop, develop, or edit.

Video:

- HTML5 playback with play/pause, seek, volume, and fullscreen;
- poster from the thumbnail cache;
- standard playback only; no speed menu or codec inspector.

Details:

- date, precision, and source;
- format, size, dimensions, and duration when known;
- original path, **Reveal in Explorer**, **Open externally**;
- available technical metadata, collapsible; omit empty sections;
- read-only note.

States:

- photo;
- video;
- missing file: metadata retained, media unavailable, reconnect message;
- unsupported/unplayable format: clear message and open externally;
- thumbnail unavailable: placeholder;
- drive disconnected.

Explicitly absent in Phase 2:

- **Set date** and date overrides (Phase 3);
- duplicate section and duplicate navigation (Phase 4);
- ratings, favorites, collections, tags;
- histogram, GPS map, reverse geocoding;
- RAW develop tools;
- delete, move, rename, cleanup.

### 3. Shell updates

- Sidebar gains a real **Memory Lane** destination.
- Remove the "Library screens arrive in Phase 2" placeholder note.
- Keep **Scan & processing** and the drive drawer.
- Do not add Date unavailable, Other files, Library health, or Settings yet.
- Scan completion report gets an **Open Memory Lane** action when the catalog
  contains media.

## Platform/Core scope

### Contracts

Agent A owns `src/shared/contracts/library.ts`, channel names, Zod schemas,
preload methods, and the typed API. The proposed shapes are below; changes need
both agents' review and a contract test update.

```ts
type LibraryFilter = "all" | "photos" | "videos";
type TimelinePrecision = "year" | "month" | "exact";
type ThumbnailStatus = "pending" | "ready" | "failed";

interface LibraryDate {
  value: string | null; // ISO timestamp
  precision: TimelinePrecision | null;
  source: string | null;
}

interface LibraryItem {
  fileId: number;
  name: string;
  mediaClass: "image" | "video";
  format: string | null;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  date: LibraryDate;
  thumbnailStatus: ThumbnailStatus;
  thumbnailUrl: string | null; // ml-media URL; null when failed
  isMissing: boolean;
}

interface LibrarySummary {
  totalItems: number;
  photoCount: number;
  videoCount: number;
  indexedBytes: number;
  undatedCount: number;
  lastScanAt: string | null;
}

interface LibraryMonth {
  year: number;
  month: number;
  count: number;
}

interface LibraryTimelinePage {
  items: LibraryItem[];
  nextCursor: string | null;
  total: number;
}

interface LibraryItemDetails {
  item: LibraryItem;
  path: string;
  folder: string;
  createdAtFs: string | null;
  modifiedAtFs: string;
  metadata: Array<{ key: string; value: string; source: string }>;
  position: number; // 1-based within the active filter
  total: number;
  previousFileId: number | null;
  nextFileId: number | null;
  mediaUrl: string | null; // null when missing
}
```

IPC channels:

| Channel | Method | Params | Result |
|---|---|---|---|
| `library:get-summary` | `getLibrarySummary` | none | `LibrarySummary` |
| `library:get-timeline` | `getLibraryTimeline` | `{ filter, cursor?, year?, month?, limit? }` | `LibraryTimelinePage` |
| `library:get-timeline-index` | `getLibraryTimelineIndex` | `{ filter }` | `{ months: LibraryMonth[] }` |
| `library:get-item` | `getLibraryItem` | `{ fileId, filter? }` | `LibraryItemDetails` |
| `shell:reveal-item` | `revealLibraryItem` | `{ fileId }` | `void` |
| `shell:open-item` | `openLibraryItem` | `{ fileId }` | `void` |

`year` and `month` anchor a fresh timeline query at that period. They are
mutually exclusive with `cursor`. The query returns items from that period
downward in descending date order.

Ordering is `resolved_date DESC` then `file_id DESC`. Undated items sort last.
`nextCursor` is opaque. `total` is the count for the active filter.

### Database and queries

Catalog migration 3:

- add `files.width`, `files.height`, `files.duration_seconds`;
- backfill width/height from the Phase 1 `media.width` / `media.height`
  metadata rows;
- add a timeline index on `file_dates(resolved_date DESC, file_id DESC)`.

The library query joins `files`, `file_dates`, and thumbnail cache state. It
must use keyset cursor pagination, not offset paging. Item position is computed
with a count query for the viewer only.

Video duration is nullable. Phase 2 adds a small, dependency-free ISO-BMFF
duration reader for MP4/MOV files and stores what it can; other formats remain
null. The grid shows duration only when known. The viewer reads the real
duration from the media element once loaded.

Date grouping uses the stored precision:

- `exact` → day section;
- `month` → month section;
- `year` → year section;
- no date → trailing Date unavailable section.

Phase 1's filesystem dates are the Phase 2 fallback. Phase 3 replaces them with
the full priority chain and overrides.

### Media and thumbnail protocol

Register a privileged `ml-media` scheme before the app is ready. Use:

- `ml-media://thumbnail/<fileId>`
- `ml-media://media/<fileId>`

Thumbnails:

- serve the cache entry when ready;
- if missing, generate on demand through a shared thumbnail scheduler;
- the scheduler has an interactive queue for protocol requests and a bulk queue
  for scan work; interactive requests preempt bulk work;
- deduplicate in-flight work per file;
- write the cache file and `cache_entries` row through the DB worker;
- return 404 on failure, so the renderer can show a placeholder.

Media:

- resolve the file path from the catalog by `fileId`; never accept a path from
  the renderer;
- only serve cataloged files that are present;
- support HTTP range requests (`206`, `Content-Range`, `Accept-Ranges`) for
  video seeking;
- correct MIME type;
- stream/read the source read-only;
- return 404 for missing files.

CSP in `src/renderer/index.html` must allow `ml-media:` in `img-src` and
`media-src`. Agent B owns that renderer shell change.

### Reveal and external open

- Use Electron `shell.showItemInFolder` and `shell.openPath`.
- Validate the file id against the open catalog.
- Reject missing/disconnected files with typed errors.
- No write, rename, move, or delete operation is introduced.

### Scan interaction

- Refactor Phase 1 thumbnail generation behind the shared scheduler.
- A visible grid tile requests its thumbnail through the protocol; that request
  is interactive priority.
- Bulk scan thumbnails remain low priority and can be paused by the existing
  intensity control.
- If a thumbnail is already ready, the protocol serves it without work.
- If a scan is running, library queries must stay responsive.

## Agent split

### Agent A — Platform/Core

- Contract schemas, channels, preload, typed API, contract tests.
- Catalog migration 3 and library repositories/queries.
- Library service and item details/neighbors.
- `ml-media` protocol, range handling, CSP contract.
- Shared thumbnail scheduler and Phase 1 scan integration.
- MP4/MOV duration reader.
- Reveal/open handlers.
- Fixture catalog generator and performance queries.
- Integration tests, E2E, packaged smoke.
- Add `@tanstack/react-virtual` pinned to the Platform branch and keep
  `package.json` ownership.

### Agent B — Renderer/UX

- Memory Lane route, timeline, filters, density, year/month navigation.
- Virtualized grouped grid using `@tanstack/react-virtual`.
- Lazy thumbnails, skeleton/failed/missing states.
- Combined photo/video viewer and details panel.
- Previous/next, keyboard navigation, reveal/open actions.
- Shell navigation updates and CSP `ml-media:` allowance.
- Component tests; no production mock adapter.

### Integration sequence

1. Agent A lands the contract and dependency commit first.
2. Agent B starts the renderer from that commit, not from an older `main`.
3. Agent A implements the query/protocol backend behind the same contract.
4. Integrate every 2–3 days; do not wait for both branches to finish.
5. Agent A adds the real E2E and packaged smoke; Agent B adds component tests.

If the contract is not available when Agent B starts, Agent B builds layout and
viewer components against test-only fixtures and reports the contract request.
It must not add a mock scan/library path to the production default client.

## Data and performance targets

- 10,000-item synthetic catalog in CI integration tests.
- Manual 100,000-item check before calling Phase 2 done.
- Timeline page size: 200 items.
- First timeline page should render without loading the full catalog.
- Only visible grid rows plus a small overscan may mount.
- Thumbnail requests for visible tiles should be issued before off-screen work.
- No N+1 query per tile. Counts, dimensions, dates, and thumbnail status must be
  joined or batched.

## Testing and quality

- Contract tests for every library schema and channel.
- DB integration tests for filters, cursor paging, date grouping boundaries,
  month anchors, missing files, undated items, and item position.
- Protocol tests for thumbnail generation, 404s, media range requests, and
  invalid file ids.
- Scheduler tests for interactive-over-bulk priority and deduplication.
- Renderer tests for timeline grouping, virtualization, filters, density,
  year/month navigation, viewer photo/video/missing/unsupported states,
  previous/next, keyboard navigation, and reveal/open actions.
- E2E: scan a fixture drive, open Memory Lane, filter, open a photo, move next,
  open a video, and verify thumbnail/media rendering.
- Packaged smoke: open a seeded library and load a thumbnail.
- Same quality gates as Phase 1: strict TypeScript, 400-line hard limit,
  complexity limits, dependency-cruiser, knip, coverage, Playwright.

## Risks and decisions

- **Virtualization:** grouped headers plus a variable-height grid is the main UI
  risk. Use a flattened row model and TanStack Virtual.
- **Range streaming:** video seeking needs a correct 206 implementation. Test it
  with a fixture video, not only a photo.
- **Thumbnail scheduler:** Phase 1 generates thumbnails directly in the scan
  runner. Phase 2 must unify interactive and bulk work without deadlocking the
  DB worker.
- **Video codecs:** Chromium cannot play every cataloged video. Unsupported
  playback must fall back to open externally.
- **Dates:** Phase 2 displays Phase 1 filesystem dates. Do not invent month/day
  precision. Phase 3 owns EXIF and overrides.
- **Fixed non-system drives:** Phase 1 treats fixed non-system volumes such as
  `D:` as archive sources. Phase 2 preserves that behavior unless changed
  explicitly.
- **Memory:** do not keep all timeline items in renderer state. Keep pages and
  virtualized rows bounded.
