# Memory Lane

Memory Lane is a local-first, read-only archive catalog for Windows. It helps
you rediscover personal photos and videos across large external drives without
moving, renaming, editing, or deleting the originals.

## Status

This repository currently contains the product definition, the v0.1 scope and
implementation plan, and a clickable UI prototype. The Electron application has
not been scaffolded yet.

## Repository layout

```text
Memory_Lane_Product_Specification.md      Original product specification
Memory_Lane_Scope_and_Implementation.md   v0.1 scope, architecture, and build plan
ui-mockups/                               Clickable static prototype
  index.html                              Prototype screen map and entry point
  assets/                                 Shared CSS, JS, fonts, and local images
docs/
  adr/                                    Architecture decision records
  quality-exceptions.md                   Approved quality-rule exceptions
.github/pull_request_template.md          Review and quality checklist
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

## Planned technology

| Layer | Choice |
|---|---|
| Desktop shell | Electron with a strict preload/IPC boundary |
| Build | `electron-vite` |
| Packaging | `electron-builder` (NSIS per-user installer + portable ZIP) |
| Renderer | React + TypeScript + HashRouter |
| Data and UI state | TanStack Query + Zustand |
| Styling and primitives | CSS Modules + design tokens + Radix + Lucide |
| Database | `better-sqlite3` with SQL migrations and repositories |
| Workers | Piscina worker pools |
| Media tooling | ExifTool, ffmpeg/ffprobe, Sharp |
| Validation | Zod IPC contracts |
| Tests | Vitest + Testing Library + Playwright Electron |

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
