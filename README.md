# Memory Lane

Memory Lane is a local-first, read-only archive catalog for Windows. It helps
you rediscover personal photos and videos across large external drives without
moving, renaming, editing, or deleting the originals.

## Status

Phase 0 is implemented: the Electron application shell, secure preload/IPC
boundary, dedicated SQLite database worker, `app.db` + per-drive `catalog.db`
migrations, Windows drive identity, logging, quality gates, unit/integration/E2E
tests, and Windows packaging all work.

Phase 1 platform work is implemented: drive-list connectivity and letter-change
flags, the scan coordinator, four persisted stages, pause/resume/intensity,
interruption recovery, incremental change/missing/moved detection, and the
completion report. The renderer for the Phase 1 screens is being built in
parallel. See `docs/phase-1-scan-contract.md` for the frozen scan contract.

The media browsing screens and full product UI remain later phases. The static
prototype in `ui-mockups/` remains the design reference.

## Repository layout

```text
src/
  main/                                Electron main, DB worker, services
  preload/                             Typed contextBridge API
  renderer/                            React foundation screen
  shared/                              IPC contracts and domain types
tests/
  integration/                         Real SQLite and temp-filesystem tests
  e2e/                                 Playwright Electron flows
scripts/                               Binaries, file-size gate, package checks
resources/bin/                          Fetched native binaries (Phase 1)
docs/
  adr/                                 Architecture decision records
  agent-workstreams.md                 Parallel agent ownership and integration rules
  quality-exceptions.md                Approved quality-rule exceptions
.github/workflows/ci.yml               Windows quality, E2E, and packaging pipeline
.github/pull_request_template.md       Review and quality checklist
ui-mockups/                            Clickable static prototype
Memory_Lane_Product_Specification.md   Original product specification
Memory_Lane_Scope_and_Implementation.md v0.1 scope, architecture, and build plan
```

## View the prototype

Open `ui-mockups/index.html` directly in a browser. The prototype is fully
static and local: no server, account, or network connection is required.

The prototype covers the planned v0.1 screens:

- Drive selection and changed-drive-letter confirmation
- Memory Lane chronological photo/video timeline
- Combined photo and video viewer
- Date unavailable with manual year/year-month assignment
- Other files category browser
- Library health with Missing files, Duplicates, and Validation
- Scan and processing states
- Settings

The prototype uses sample data. Actions that would touch the real filesystem
show an explanatory toast instead.

## Read-only guarantee

Memory Lane indexes files in place. The application must never move, rename,
edit, or delete original files. Catalog databases, thumbnail caches, logs, and
PC backups live in app-managed locations outside the original archive folders.

## Technology

Current Phase 0 foundation:

| Layer | Choice |
|---|---|
| Desktop shell | Electron 42 with `contextIsolation`, `sandbox`, and a narrow preload API |
| Build | `electron-vite` |
| Packaging | `electron-builder` (NSIS per-user installer + portable ZIP) |
| Renderer | React 19 + TypeScript + HashRouter |
| Data | TanStack Query over typed IPC |
| Styling | CSS Modules + design tokens + Lucide icons |
| Database | `better-sqlite3` in a dedicated worker; PC `app.db` + per-drive `catalog.db` |
| Contracts | Zod |
| Logging | `electron-log` |
| Tests | Vitest + Testing Library + Playwright Electron |
| Distribution | Unsigned NSIS installer + portable ZIP; SmartScreen warning documented |

Planned additions for the next phases: Piscina worker pools, Zustand for local UI
state, Radix primitives, TanStack Virtual, React Hook Form, ExifTool,
ffmpeg/ffprobe, and Sharp.

## Development

Node **22.12+** is required. The repo includes `.nvmrc` and `.node-version`.

```text
npm ci

# Development (rebuilds better-sqlite3 for Electron first)
npm run dev

# Fast local quality checks
npm run check

# Unit, component, and integration tests with coverage
npm run test:coverage

# Build + Playwright Electron E2E
npm run test:e2e

# Full Windows package: NSIS installer + portable ZIP
npm run package:win
npm run verify:package
npm run smoke:packaged
```

Native module note: `better-sqlite3` must match the running ABI. The test scripts
rebuild it for Node before unit/integration tests, and fetch the pinned Electron
prebuild before development, E2E, and packaging. `npm run dev` does the Electron
rebuild automatically. `electron-builder` is configured with `npmRebuild: false`
because the prebuilt Electron binary is already selected.

Phase 0 stores its SQLite databases here:

```text
%LOCALAPPDATA%\MemoryLane\app.db          Installed app state
%LOCALAPPDATA%\MemoryLane-dev\app.db      Development app state
<drive>\.memorylane\catalog.db            Per-drive catalog
<drive>\.memorylane\cache\                Generated previews (Phase 1)
```

### What dev mode does

`npm run dev` starts a Vite dev server for the renderer and launches Electron
against it.

- React and CSS changes hot-reload in the desktop window. Component state usually
  survives a React Fast Refresh.
- Main-process and preload changes trigger a rebuild and Electron relaunch.
- DevTools are enabled in development (`Ctrl+Shift+I`).
- Main-process logs appear in the terminal and in
  `%LOCALAPPDATA%\MemoryLane-dev\logs\main.log`.
- SQL migration files are bundled at build time. After editing a migration,
  restart dev and use a fresh development catalog if the old schema is
  incompatible.

### Install and update a local build

```text
npm run package:win
```

This produces:

```text
release\Memory-Lane-Setup-0.1.0-x64.exe   Per-user NSIS installer
release\Memory-Lane-0.1.0-x64.exe         Portable single-file build
release\win-unpacked\Memory Lane.exe      Unpacked app for quick testing
```

To install, run the setup EXE. It installs per-user under
`%LOCALAPPDATA%\Programs\Memory Lane` without administrator rights and creates a
Start Menu shortcut.

To update an installed personal build:

1. Change `version` in `package.json` (for example `0.1.1`).
2. Run `npm run package:win` again.
3. Run the new setup EXE. It installs over the existing app.
4. The app data in `%LOCALAPPDATA%\MemoryLane` and the archive catalogs remain.

There is no auto-updater and no published release channel. Installed builds do
not update themselves. Running `npm run dev` does not update the installed app;
it runs the source tree with the `MemoryLane-dev` data directory. The uninstaller
removes the application, not the app data, archive catalogs, or backups.

### Why not Docker

Electron is a Windows desktop GUI application. It needs a native window, direct
access to external drive letters, Windows Explorer integration, and eventually
media playback. Docker Desktop on Windows does not give a normal desktop app
that can see USB drive letters the way the product requires, and GUI/USB
passthrough would be fragile.

Docker is not used for runtime. The build toolchain is ordinary Node/npm, and
packaging uses Windows-native `electron-builder`/NSIS. A Windows CI runner is the
right place to build and smoke-test the installer.

## Engineering standards

The project treats structural quality as a CI gate, not a review preference:

- 400-line hard file limit, 300-line soft target
- Cyclomatic complexity 10, cognitive complexity 15
- TypeScript strict mode; no explicit `any`
- Enforced renderer/main/preload/shared architecture boundaries
- 80% overall coverage, 90% for critical modules
- Unit, component, integration, contract, E2E, and packaged-smoke tests
- GitHub Actions quality, test, E2E, and packaging jobs on Windows

The exact libraries, architecture, quality rules, CI pipeline, bundling, and
release checklist are defined in `Memory_Lane_Scope_and_Implementation.md`.

## Parallel development

The project is designed to run with multiple coding agents from Phase 1 onward:

- **Platform/Core** — Electron main process, DB worker, scanning, media tools,
  packaging
- **Renderer/UX** — React app, design system, screens, accessibility
- **Quality/Release** — CI, E2E, fixtures, packaging smoke tests, ADRs

Path ownership, contract-first integration, worktree/branch rules, and agent
prompts are documented in `docs/agent-workstreams.md`. The summary and
phase-by-phase split are in §15 of the implementation plan.

## Future features

These are explicitly post-v0.1 and are not part of current acceptance criteria:

- **Places map** — a local-only globe showing only photos and videos with GPS
  metadata. Items without location data are excluded.
- **Non-memory images** — local AI classification of screenshots, app captures,
  receipts, bank statements, documents, and similar low-value images. Review-only
  by default; it never deletes or hides files automatically.

The technical designs, data models, privacy rules, and acceptance criteria are in
§16 of the implementation plan.
