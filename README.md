# Memory Lane

Memory Lane is a local-first, read-only archive catalog for Windows. It helps
you rediscover personal photos and videos across large external drives without
moving, renaming, editing, or deleting the originals.

## Status

Phases 0-4 are implemented:

- Electron application shell with a narrow preload IPC boundary.
- Dedicated SQLite database worker for PC and per-drive catalogs.
- Drive selection, catalog setup, and changed-letter confirmation.
- Four-stage scanning with pause/resume/intensity and interruption recovery.
- Incremental changes, missing-file marking, moved-candidate detection, and a
  completion report.
- Memory Lane timeline with filters, density, year/month navigation, and a
  virtualized grid.
- Combined photo/video viewer with details, previous/next, reveal, and
  open-external actions.
- Viewport-priority thumbnails through the `ml-media` protocol.
- ExifTool-based EXIF/XMP/video date extraction with filesystem fallbacks.
- Date unavailable, bulk year/year-month assignment, and reversible catalog-only
  overrides in the viewer.
- Library health with duplicate groups, missing/moved-file management, duplicate
  badges, and whole-catalog validation with pause/resume.
- Windows installer, portable build, E2E flows, and a packaged EXIF smoke test.

Phase 5 (other files and settings) is next. See `docs/roadmap.md` for the
remaining work.

## Documentation

Start at `docs/README.md`.

| Document | Purpose |
|---|---|
| `docs/Memory_Lane_Product_Specification.md` | Product vision and requirements |
| `docs/Memory_Lane_Scope_and_Implementation.md` | Current scope, architecture, data model, and quality gates |
| `docs/roadmap.md` | Delivered phases and next steps |
| `docs/phase-3-scope.md` | Implemented dates, ExifTool, overrides, and Date unavailable |
| `docs/phase-4-scope.md` | Implemented duplicates, missing/moved files, and validation |
| `docs/health-contract.md` | Library health IPC and validation contract |
| `docs/scan-contract.md` | Scan IPC and state contract |
| `docs/library-contract.md` | Library IPC, media protocol, and viewer contract |
| `docs/agent-workstreams.md` | Parallel agent rules |
| `docs/quality-exceptions.md` | Approved quality exceptions |

The static files in `ui-mockups/` are a design reference only.

## Repository layout

```text
src/
  main/                                Electron main, services, and DB worker
  preload/                             Typed contextBridge API
  renderer/                            React application
  shared/                              IPC contracts and domain types
tests/
  integration/                         Real SQLite and temp-filesystem tests
  e2e/                                 Playwright Electron flows
scripts/                               Gates, packaging checks, smoke tests
resources/bin/                          Reserved for future native binaries
docs/                                   Product, scope, contracts, and roadmap
.github/workflows/ci.yml               Windows quality, E2E, and packaging
ui-mockups/                            Static design reference
```

## Read-only guarantee

Memory Lane indexes files in place. The application must never move, rename,
edit, or delete original files. Catalog databases, thumbnail caches, logs, and
PC backups live in app-managed locations outside the original archive folders.

## Technology

| Layer | Choice |
|---|---|
| Desktop shell | Electron 42 with `contextIsolation`, `sandbox`, and a narrow preload API |
| Build | `electron-vite` |
| Packaging | `electron-builder`: NSIS per-user installer and portable executable |
| Renderer | React 19 + TypeScript + HashRouter |
| Data | TanStack Query over typed IPC |
| Virtualization | TanStack Virtual |
| Styling | CSS Modules + design tokens + Lucide icons |
| Database | `better-sqlite3` in a dedicated worker; PC `app.db` + per-drive `catalog.db` |
| Metadata | ExifTool 13.60 through `exiftool-vendored` |
| Contracts | Zod |
| Logging | `electron-log` |
| Tests | Vitest + Testing Library + Playwright Electron |
| Distribution | Unsigned Windows build; no auto-update |

ExifTool is a runtime dependency and ships with the app. ffmpeg/ffprobe and
Sharp are candidates for later video thumbnail/playback work. Third-party
license notices are in `THIRD_PARTY_NOTICES.md`.

## Development

Node **22.12+** is required. The repository includes `.nvmrc` and
`.node-version`.

```text
npm ci

# Development (rebuilds better-sqlite3 for Electron first)
npm run dev

# Fast static checks
npm run check

# Unit, component, and integration tests with coverage
npm run test:coverage

# Build + Playwright Electron E2E
npm run test:e2e

# Full local gate: static checks + coverage + E2E
npm run check:full

# Windows package: NSIS installer + portable executable
npm run package:win

# Refresh release/win-unpacked for local testing
npm run package:unpacked

npm run verify:package
npm run smoke:packaged
```

Native module note: `better-sqlite3` must match the running ABI. Test scripts
rebuild it for Node before unit/integration tests and fetch the pinned Electron
prebuild before development, E2E, and packaging. `electron-builder` uses
`npmRebuild: false` because the correct Electron binary is already selected.

SQLite locations:

```text
%LOCALAPPDATA%\MemoryLane\app.db          Installed app state
%LOCALAPPDATA%\MemoryLane-dev\app.db      Development app state
<drive>\.memorylane\catalog.db            Per-drive catalog
<drive>\.memorylane\cache\                Generated thumbnails and previews
```

### Dev mode

`npm run dev` starts the Vite renderer server and launches Electron against it.
React and CSS changes hot-reload. Main-process and preload changes rebuild and
relaunch Electron. DevTools are enabled in development. Main-process logs appear
in the terminal and in `%LOCALAPPDATA%\MemoryLane-dev\logs\main.log`.

Migration files are bundled at build time. After editing a migration, restart
dev with a fresh development catalog if the old schema is incompatible.

### Install a local build

`npm run package:win` produces:

```text
release\Memory-Lane-Setup-0.1.0-x64.exe   Per-user NSIS installer
release\Memory-Lane-0.1.0-x64.exe         Portable single-file build
release\win-unpacked\Memory Lane.exe      Unpacked app for quick testing
```

`npm run package:unpacked` refreshes `release\win-unpacked\Memory Lane.exe`
without rebuilding the installer or portable executable. Use it after code
changes when testing the unpacked app.

The installer runs without administrator rights, installs under
`%LOCALAPPDATA%\Programs\Memory Lane`, and creates a Start Menu shortcut.

To update an installed personal build, change `version` in `package.json`, run
`npm run package:win`, and run the new setup executable. App data and archive
catalogs remain. There is no auto-updater. The uninstaller removes the
application, not app data, catalogs, or backups.

### Why not Docker

Electron is a Windows desktop GUI application. It needs a native window, direct
access to external drive letters, Windows Explorer integration, and media
playback. Docker Desktop does not provide a normal desktop app with USB drive
access. Packaging uses Windows-native `electron-builder`/NSIS and a Windows CI
runner.

## Engineering standards

- 400-line hard file limit, 300-line soft target.
- Function length 100, cyclomatic complexity 10, cognitive complexity 15.
- TypeScript strict mode; no explicit `any`.
- Enforced renderer/main/preload/shared architecture boundaries.
- 80% overall coverage; 90% for shared contracts and database code.
- Unit, component, integration, contract, E2E, and packaged-smoke tests.
- GitHub Actions quality, E2E, and Windows packaging jobs.

The exact limits, test layers, and CI pipeline are in
`docs/Memory_Lane_Scope_and_Implementation.md`.

## Parallel development

The project supports multiple coding agents:

- **Platform/Core** - Electron main, DB worker, scanning, media, packaging.
- **Renderer/UX** - React app, design system, screens, accessibility.
- **Quality/Release** - CI, E2E, fixtures, packaging smoke tests, ADRs.

Path ownership, contract-first integration, worktree rules, and agent prompts
are in `docs/agent-workstreams.md`. Agents commit locally; the human reviews and
pushes.

## Future features

These are post-v0.1 and are not part of current acceptance criteria:

- **Places map** - local-only globe for photos and videos with valid GPS
  metadata. Items without location data are excluded.
- **Non-memory images** - local AI classification of screenshots, receipts,
  documents, and similar images. Review-only by default; it never deletes or
  hides files automatically.
- **Partial backups** - verified backups of selected media to smaller
  destination drives, with cumulative coverage.

See `docs/roadmap.md` and the product specification for details.

## License

Memory Lane is released under the MIT License. See `LICENSE` for the full text.
Third-party components are listed in `THIRD_PARTY_NOTICES.md`.
