# Agent B — Renderer/UX, Phase 2

You are the **Renderer/UX agent** for Memory Lane Phase 2.

## Workspace

- Repository: `C:\Users\Renan Ju e Julia\Documents\GitHub\memory-lane`
- Create and use a fresh worktree from the Phase 2 contract commit:
  - `../memory-lane-renderer-phase-2`
  - branch `agent/renderer-phase-2`
- Do not reuse the Phase 1 renderer worktree; its branch is already integrated.
- Do not push to `origin`. Commit locally with one-line messages.
- Node 22.12+ is required.

Read before changing anything:

- `AGENTS.md` in the parent workspace
- `docs/phase-2-scope.md` — authoritative Phase 2 scope and contract
- `Memory_Lane_Scope_and_Implementation.md`, especially §6.2, §6.3, §6.7,
  §7.2.1, §7.11, §7.14, §8, §9 Phase 2, and §15
- `docs/agent-workstreams.md`
- Current `src/shared/contracts`, `src/preload`, `src/main/modules/scanning`,
  and `src/renderer`
- `ui-mockups/chronological-gallery.html` and `ui-mockups/media-viewer.html`

Phase 1 is integrated on `main`. Agent A (Platform/Core) now owns the library
query backend, `ml-media` protocol, thumbnail scheduler, and shared library
contract. **You own the renderer only.**

## Contract gate

Before implementation, check that `src/shared/contracts/library.ts` exists and
contains the Phase 2 contract from `docs/phase-2-scope.md`.

- If it exists, base your worktree on the commit that contains it.
- If it does not exist, start with static layout and component work against
  test-only fixture data, and report the missing contract immediately. Do not
  invent production IPC, duplicate the shared contract, or ship a mock client as
  the default.
- Do not edit `src/shared/**`, `src/main/**`, `src/preload/**`, `package.json`,
  `package-lock.json`, test configs, or `tests/e2e/**`.
- You may edit `src/renderer/**`, including
  `src/renderer/src/lib/ipc-client.ts` and `src/renderer/index.html`.
- Platform will add `@tanstack/react-virtual`. Do not add dependencies. If it is
  absent when you need it, build behind a `VirtualGrid` seam and report blocked.

## Scope: Phase 2 renderer

### 1. Memory Lane page

Route: `/library`.

- Header: Memory Lane, item count, indexed size, last scan, read-only marker.
- Filters: All / Photos / Videos.
- Density: Comfortable / Dense.
- Year chips and previous/next month navigation using the timeline index.
- Date-grouped sections by precision: day, month, or year.
- Undated items at the end under an informational **Date unavailable** section.
  Do not link to a Date unavailable screen; it is Phase 3.
- Virtualized grid using `@tanstack/react-virtual`.
- Tile:
  - lazy thumbnail from `thumbnailUrl`;
  - skeleton until loaded, placeholder on error;
  - video duration and play glyph when known;
  - missing badge for missing files;
  - filename and size on hover/focus;
  - keyboard-openable and accessible.
- No selection checkboxes, duplicate badges, ratings, favorites, collections,
  tags, search, or cleanup actions.
- States: populated, empty filter, no media, loading, thumbnail pending/failed,
  missing file, drive unavailable.
- Preserve the scroll position when changing density. Filter changes may start
  from the top.
- Use cursor pagination with `useInfiniteQuery`; do not load the full catalog.

### 2. Media viewer

Route: `/library/item/:fileId`, preserving the active filter in the query string.

- Back to Memory Lane, filename, position, previous/next.
- Photo: fit / 100%, previous/next.
- Video: HTML5 playback with native play/pause, seek, volume, and fullscreen;
  poster from `thumbnailUrl`.
- Details:
  - date and precision/source;
  - format, size, width/height, duration when known;
  - original path, **Reveal in Explorer**, **Open externally**;
  - available technical metadata in a collapsible section; omit empty sections;
  - read-only note.
- States:
  - photo;
  - video;
  - missing file: metadata remains visible, media unavailable;
  - unsupported/unplayable media: clear message and open-externally action;
  - thumbnail unavailable;
  - drive disconnected.
- Keyboard: Left/Right previous/next when focus is not inside media controls or
  an input; Escape returns to the library.
- No Set date, date override, duplicate section, ratings, favorites, tags,
  histogram, map, RAW tools, or edit actions.

### 3. Shell and completion handoff

- Add **Memory Lane** to the sidebar as a real destination.
- Remove the “Library screens arrive in Phase 2” note.
- Keep **Scan & processing** and the drive drawer.
- Do not add Date unavailable, Other files, Library health, or Settings.
- Top bar: Memory Lane breadcrumb on the library, filename on the viewer.
- Add an **Open Memory Lane** action to the scan completion report when the
  catalog contains media. Keep the existing Phase 3/4 handoff language honest.

### 4. Media URLs and CSP

- Use `thumbnailUrl` and `mediaUrl` from the contract.
- Add `ml-media:` to `img-src` and `media-src` in `src/renderer/index.html`.
- Do not fetch thumbnails over IPC in a loop. Let the protocol request them.
- Use `loading="lazy"`, `decoding="async"`, and width/height hints to avoid
  layout shift.

## Data and state rules

- Use TanStack Query for summary, timeline pages, timeline index, and item
  details.
- Keep query keys centralized in `src/renderer/src/lib/query-keys.ts`.
- Keep only ephemeral UI state in React/context: density, active year/month,
  viewer mode, failed-thumbnail ids, and similar.
- Do not put catalog data in global state.
- Do not keep more timeline pages in memory than needed for the virtualized
  viewport and a small overscan.
- Use the real `MemoryLaneApi` through the renderer `api` wrapper. Test fixtures
  and fake clients are allowed only in tests.
- Do not create a production `ipc-client.mock.ts` default path.

## Testing

Add renderer tests under `src/renderer/**/*.test.tsx`.

Cover at minimum:

- timeline loading, populated, empty filter, and drive-unavailable states;
- filters and density;
- year chips and month navigation;
- grouped sections for exact/month/year precision and undated items;
- virtualization: only visible rows mount for a large fixture;
- thumbnail skeleton, ready, and failed states;
- video duration and missing badges;
- viewer photo, video, missing, unsupported, and disconnected states;
- previous/next and keyboard navigation;
- reveal/open actions and their disabled/error states;
- scan completion → Open Memory Lane handoff.

Run:

```powershell
$env:Path = "$env:LOCALAPPDATA\Programs\node22;$env:Path"
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
npm.cmd run check:file-size
npx vitest run src/renderer
```

If you launch the app:

```powershell
npm.cmd run dev
```

`npm run dev` rebuilds `better-sqlite3` for Electron first. Do not run
`test:coverage` and then launch an already-built Electron app without rebuilding
the native module.

Quality limits:

- 400 lines per file hard; 300-line soft target.
- 100 lines per function.
- Cyclomatic complexity 10; cognitive complexity 15.
- No explicit `any`.
- No floating promises.
- No blanket ESLint disables.
- No out-of-scope features or dead controls.

## Deliverables

- Updated renderer routes, shell, pages, components, styles, and tests.
- A renderer `VirtualGrid` abstraction, even if the dependency lands later.
- Test-only fixtures for every viewer and timeline state.
- A short report containing:
  - files changed;
  - commands run and results;
  - contract requests for Agent A;
  - anything blocked;
  - what the next agent needs to know.

Commit locally on `agent/renderer-phase-2`. Do not push. Do not merge to
`main`; the human/architect integrates.
