# Agent B — Renderer/UX, Phase 1

You are the **Renderer/UX agent** for Memory Lane Phase 1.

## Workspace

- Repository: `C:\Users\Renan Ju e Julia\Documents\GitHub\memory-lane`
- Create and use a separate git worktree:
  - `../memory-lane-renderer`
  - branch `agent/renderer`
- Do not push to `origin`. Commit locally with one-line messages.
- Node 22.12+ is required.

Read before changing anything:

- `AGENTS.md` in the parent workspace
- `Memory_Lane_Scope_and_Implementation.md`, especially §5.3–5.5, §6.1, §6.7, §7.2.1, §7.15, §8, §9, and §15
- `docs/agent-workstreams.md`
- `docs/quality-exceptions.md`
- `ui-mockups/drive-selection.html`
- `ui-mockups/scan-processing-dashboard.html`
- `ui-mockups/index.html`
- The current `src/renderer`, `src/shared/contracts`, and `src/preload`

Phase 0 is complete. Agent A (Platform/Core) is implementing the Phase 1
main-process work in parallel: drive identity confirmation, scan coordinator,
stage progress, pause/resume, intensity, and completion report. **You own the
renderer only.**

## Scope: Phase 1 UI only

### 1. Phase 1 app shell

Build a shell that can grow, but only expose destinations that exist now.

- Before a catalog is open: show the drive-selection gate.
- After opening or creating a catalog: show the app shell with the
  **Scan & processing** destination.
- Sidebar bottom: drive card that opens the drive drawer.
- Top bar: breadcrumb, background scan chip, read-only pill.
- Do not render dead links for Memory Lane, Date unavailable, Other files,
  Library health, or Settings yet. They arrive in later phases.
- Use the dark amber design language, CSS Modules, design tokens, and Lucide
  icons. Do not add new dependencies.
- Preserve the Phase 0 app-info/database status somewhere useful; it can live in
  the drive drawer or a small foundation-status section.

### 2. Drive selection gate

Implement the real Phase 1 drive selection flow:

- Connected drive with an existing catalog.
- Connected drive without a catalog.
- Previously registered drive that is offline.
- No external drives detected.
- Windows system drive is visible but unsupported for catalog creation.
- Drive identity details: label, letter, filesystem, serial/volume id, capacity,
  last scan, catalog status.
- Actions:
  - Open existing catalog.
  - Set up a new catalog.
  - Rescan drives.
  - Switch drive from the drawer.
- Setup modal:
  - Explain app-managed `.memorylane` locations.
  - Start the first scan.
  - No worker-concurrency, cache-destination, NAS, MFT, SMART, or unmount
    controls.
- Changed-drive-letter confirmation:
  - If the current contract exposes the state, implement the confirmation modal.
  - If it does not, build it behind the mock adapter and report the contract
    request. Do not edit shared contracts.
- Every visible control must work or be clearly disabled with a reason.

### 3. Scan & processing page

Implement these states:

- `idle`
- `active`
- `paused`
- `interrupted`
- `complete`
- `error` / drive unavailable

Content and actions:

- Four stages: **Catalog files**, **Extract metadata**, **Generate thumbnails**,
  **Calculate hashes**.
- Per-stage status, processed count, total, and progress.
- Totals may be unknown while discovering; communicate that honestly.
- Pause / resume.
- Intensity: Eco / Balanced / Max.
- Safe-interruption language: progress is saved and resume is manual.
- Completion report: new files, changed files, missing files, likely moved files.
- Link to the next appropriate action. If the library does not exist yet, make
  the Phase 2 handoff explicit rather than linking to a dead screen.
- Error state for a disconnected drive.

Do not include:

- Throughput/MB-per-second widgets.
- WAL size or cache size.
- Live worker/event stream.
- Volume diagnostics.
- Duplicate counters.
- Unmount, format, repair, or delete actions.

### 4. Drive drawer

- Drive identity, connection state, capacity, catalog path, last scan.
- Switch drive.
- Reveal in Explorer as a prototype-safe action or clearly explained disabled
  action.
- No unmount, format, repair, or destructive controls.

### 5. UX quality

- Loading, empty, and error states for every data surface.
- Keyboard focus, aria labels, and meaningful button names.
- Responsive at 1280px and 1600px widths.
- No placeholder buttons that do nothing.
- No “coming soon” links in the navigation.

## Contract and mock rules

Do not edit `src/shared/**`, `src/main/**`, `src/preload/**`, `package.json`,
`package-lock.json`, test configs, or `tests/e2e/**`.

Use the existing Phase 0 API for drives and catalogs:

- `getAppInfo`
- `listDrives`
- `initializeCatalog`
- `openCatalog`

Build a typed mock adapter for Phase 1 in
`src/renderer/src/lib/ipc-client.mock.ts` (or equivalent) so the renderer can be
developed and tested before Agent A finishes the real scan IPC.

Proposed Phase 1 scan shape for your mocks (Agent A will freeze the real
contract):

- `ScanStatus`: `idle` | `active` | `paused` | `interrupted` | `complete` | `error`
- `ScanStageId`: `catalog` | `metadata` | `thumbnails` | `hashes`
- `ScanStageState`: `queued` | `active` | `complete` | `paused` | `failed`
- `ScanStage`: `id`, `state`, `processed`, `total` (nullable)
- `ScanReport`: `newFiles`, `changedFiles`, `missingFiles`, `movedCandidates`
- `ScanState`: `driveLabel`, `volumeId`, `status`, `mode`, `stages`,
  `currentStage`, `startedAt`, `finishedAt`, `lastSavedAt`, `etaSeconds`,
  `intensity`, `report`, optional `errorMessage`
- `ScanIntensity`: `eco` | `balanced` | `max`

Use TanStack Query for server state. Use local React state or a small context
for transient UI state. Do not add Zustand or Radix unless a dependency change
is approved.

Keep scan API access behind a typed client so Agent A can wire the real IPC
without rewriting components. A query with a short polling interval is
acceptable for Phase 1; do not invent a push-event contract in shared code.

## Testing and quality

Add component tests under `src/renderer/**/*.test.tsx` with Testing Library and
`@testing-library/user-event`.

Cover at minimum:

- Drive selection: existing catalog, no catalog, offline, no drives, system
  drive unsupported, setup modal, changed-letter modal if implemented.
- Scan page: all six states.
- Pause/resume and intensity interactions.
- Completion report.
- Drive drawer open/close and switch-drive action.
- Error and loading states.
- Navigation from drive selection to scan after a successful mutation.

Run:

```powershell
$env:Path = "$env:LOCALAPPDATA\Programs\node22;$env:Path"
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
npm.cmd run check:file-size
npx vitest run src/renderer
```

If you need to launch the app:

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
- No out-of-scope features.

## Deliverables

- Updated renderer routes, shell, pages, components, styles, and tests.
- Typed mock scan/drive adapter with fixtures for every state.
- A short report containing:
  - files changed;
  - commands run and results;
  - contract requests for Agent A;
  - anything blocked;
  - what the next agent needs to know.

Commit locally on `agent/renderer`. Do not push. Do not merge to `main`; the
human/architect integrates.
