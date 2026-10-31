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

- Electron desktop shell with a strict preload/IPC boundary
- React + TypeScript renderer
- Node.js services in the Electron main process
- SQLite catalog per archive drive
- ExifTool and ffmpeg/ffprobe for metadata and media previews
- Vitest, Testing Library, and Playwright for unit, integration, and end-to-end
  tests
- electron-builder for the Windows installer

The exact architecture, libraries, quality gates, and packaging approach are
defined in `Memory_Lane_Scope_and_Implementation.md`.
