# Memory Lane

Memory Lane is a local-first, read-only archive catalog for Windows. It helps
you rediscover personal photos and videos across large external drives without
moving, renaming, editing, or deleting the originals.

## Status

Phase 0 is implemented: the Electron application shell, secure preload/IPC
boundary, dedicated SQLite database worker, `app.db` + per-drive `catalog.db`
migrations, Windows drive identity, logging, quality gates, unit/integration/E2E
tests, and Windows packaging all work.

The scan pipeline, media catalog, and product screens arrive in Phase 1 onward.
The static prototype in `ui-mockups/` remains the design reference.

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
%LOCALAPPDATA%\MemoryLane\app.db          Installation state
<drive>\.memorylane\catalog.db            Per-drive catalog
<drive>\.memorylane\cache\                Generated previews (Phase 1)
```

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
