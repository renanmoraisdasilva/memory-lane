# Library and viewer contract

Status: implemented in Phase 2. The authoritative TypeScript and Zod definitions
live in `src/shared/contracts/library.ts`.

## Routes

| Route | Purpose |
|---|---|
| `/library` | Chronological Memory Lane grid |
| `/library/item/:fileId` | Combined photo/video viewer |

`filter=photos`, `filter=videos`, and `density=dense` are optional query
parameters. The viewer carries the active filter and density through
previous/next navigation and returns to the same filtered grid on Escape.

## IPC contract

| Channel | API method | Params | Result |
|---|---|---|---|
| `library:get-summary` | `getLibrarySummary` | none | `LibrarySummary` |
| `library:get-timeline` | `getLibraryTimeline` | `{ filter, cursor?, year?, month?, limit? }` | `LibraryTimelinePage` |
| `library:get-timeline-index` | `getLibraryTimelineIndex` | `{ filter }` | `{ months: LibraryMonth[] }` |
| `library:get-item` | `getLibraryItem` | `{ fileId, filter? }` | `LibraryItemDetails` |
| `shell:reveal-item` | `revealLibraryItem` | `{ fileId }` | `void` |
| `shell:open-item` | `openLibraryItem` | `{ fileId }` | `void` |

## Timeline semantics

- Filters are `all`, `photos`, and `videos`.
- Ordering is `resolved_date DESC`, then `file_id DESC`.
- Undated items sort last.
- `year` and `month` anchor a fresh query at that period and return items from
  that period downward. A month anchor requires a year.
- `cursor` is opaque, keyset-based, and cannot be combined with a year or month.
- `total` is the count for the active filter, not just the current page.
- Page size defaults to 200 and is capped at 500.

## Item details

`LibraryItemDetails` returns the item, full path, folder, filesystem timestamps,
extracted metadata, the 1-based position within the active filter, total count,
previous/next file IDs, and the media URL.

Behavior:

- Missing files keep their catalog row and details but have `mediaUrl: null`.
- Failed thumbnails have `thumbnailUrl: null`.
- Details remain available while the original drive is connected or offline;
  media playback requires the original file.
- Reveal and open-external resolve the path from the catalog by file ID. The
  renderer never supplies a filesystem path.

## Media protocol

The app registers a privileged `ml-media:` scheme:

- `ml-media://thumbnail/<fileId>`
- `ml-media://media/<fileId>`

Thumbnails:

- Serve an existing cache entry when ready.
- Otherwise generate on demand through the shared thumbnail scheduler with
  interactive priority.
- In-flight work is deduplicated per file.
- The cache file and `cache_entries` row are written through the DB worker.
- Failures return 404 so the grid can show a placeholder.

Media:

- Resolve the file from the catalog by ID; never accept a path from the
  renderer.
- Serve only cataloged, present files.
- Support byte ranges (`206`, `Content-Range`, `Accept-Ranges`) for video
  seeking.
- Return the cataloged MIME type when known.
- Open the source read-only and return 404 for missing files.

The renderer CSP allows `ml-media:` in `img-src` and `media-src`.

## Presentation rules

- Date grouping uses stored precision: day for `exact`, month for `month`, year
  for `year`, and a trailing Date unavailable section for null dates.
- Phase 2 displays filesystem-derived dates. Phase 3 adds EXIF/XMP/video date
  priority and manual overrides; it must not invent missing precision.
- Unsupported video playback falls back to external open.
- No library screen moves, renames, edits, or deletes an original file.

## Verification

Covered by contract, repository, media protocol, renderer component, integration,
Electron E2E, and packaged-smoke tests. See `docs/roadmap.md` for the outstanding
manual 100,000-item performance check.
