# Security review

Status: Phase 6 automated review complete; replication, video-proxy, and duplicate-quarantine write surfaces reviewed; clean-VM manual checks pending.

## Trust boundaries

| Boundary | Trust level | Control |
|---|---|---|
| Renderer to main process | Untrusted content, trusted origin | Context isolation, sandbox, typed preload, exact sender validation |
| Main process to SQLite | Trusted code only | Single DB worker, prepared statements, Zod validation |
| Main process to archive files | Read-only by default | No direct write APIs outside cache, logs, catalog, backups, and the reviewed duplicate quarantine mover |
| Main process to replication destinations | Registered destination roots only | Single destination writer, path policy, explicit plan confirmation, read-only source guard |
| Media protocol to renderer | Catalog IDs only | `ml-media` resolves IDs through the DB worker; no raw paths |
| Main process to FFmpeg | Local child process, validated paths | Argument array, no shell, source opened read-only, output confined to the cache proxy directory |
| Package and update channel | User-installed binary | Unsigned build, no auto-update, manual download |
| Backups | Local filesystem | SQLite online backup, plaintext, latest-snapshot retention |

## Controls

- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`,
  `webviewTag: false`.
- No new windows: `setWindowOpenHandler` denies.
- No renderer navigation: `will-navigate` is prevented.
- No webviews: `will-attach-webview` is prevented.
- Permission requests and permission checks are denied.
- CSP: scripts are self-only; objects, forms, frames, and base URLs are blocked;
  media is limited to app assets and `ml-media:`.
- IPC handlers validate every payload with Zod before use.
- IPC sender validation accepts only the packaged renderer document or the
  configured development origin.
- Catalog and cache paths are built from validated drive roots and path guards.
- Media URLs use catalog IDs, not caller-provided filesystem paths.
- The DB worker is the only SQLite writer; the renderer cannot access SQLite or
  the filesystem directly.
- Original files are opened or revealed through Electron shell actions only on
  explicit user action.
- A static read-only guard fails the build if direct filesystem write calls
  appear outside the reviewed allowlist.
- Backups use SQLite's online backup API rather than copying live database files.
- Package verification checks the installer, portable build, app archive,
  native SQLite module, ExifTool, bundled FFmpeg, and SHA-256 checksums.

## Files allowed to write

The read-only guard allowlist is intentionally small:

- catalog lock creation/removal;
- generated thumbnail files;
- generated HEIC preview files;
- generated compatible video proxy files;
- generated cache deletion;
- SQLite catalog/app databases, logs, and backup copies (through their owning
  modules);
- duplicate quarantine moves through
  `modules/health/infrastructure/quarantine-mover.ts`.

No module except the reviewed duplicate quarantine mover is allowed to move,
rename, truncate, or delete an original archive file.

## Replication extension

Adoption-first replication extends the write surface to registered destination
drives. It does not relax the source-archive guarantee.

- A destination copy goes through one allowlisted adapter,
  `replication/infrastructure/destination-writer.ts`.
- The adapter rejects the source root, overlapping roots, unregistered roots,
  `..` escapes, and symlink/reparse-point escapes.
- Destination writes start only after an explicit plan confirmation.
- The app never deletes destination-only files or verified replicas. It removes
  only its own temporary files and empty directories it created.
- Source files remain open read-only. No replication IPC accepts a source path
  for writing.
- Destination media URLs use destination IDs, not paths.
- Full copies are verified with SHA-256 before they can be promoted.
- Promotion is metadata-only. It writes pre-promotion snapshots, merges catalog
  metadata, demotes the old source, and can be rolled back only before the first
  change to the new source.
- Promotion snapshots and the rollback window marker are written only by the
  allowlisted `db/promotion-snapshot-files.ts` adapter.
- The security review and read-only guard cover the destination writer and the
  promotion snapshot adapter.

## Duplicate quarantine extension

`modules/health/infrastructure/quarantine-mover.ts` is the only module allowed to
move an original archive file. It exists only for confirmed duplicate cleanup.

- It accepts only a validated catalog root, a validated quarantine root, and a
  candidate from an eligible duplicate group.
- It re-hashes the source immediately before the same-volume rename and the
  quarantined copy immediately after.
- A mismatch moves the file back to its source path and journals the restore; if
  the restore fails, the run aborts.
- It never deletes a file. The app never deletes the quarantine folder.
- It never moves the last eligible copy.
- The read-only guard allowlist names only this mover; every other source write
  remains blocked.

## Video compatible-copy extension

`modules/media/video-proxy.ts` is the only new write surface. It writes only
under `.memorylane/cache/proxies` and stores state in `cache_entries`.

- FFmpeg is spawned with an argument array, never a shell command string.
- The input path comes from the catalog by file ID and is opened read-only.
- Output is written to a unique temporary file and renamed only after FFmpeg
  exits successfully.
- The source path is never passed as an output argument, and the writer rejects
  jobs for files that are not present videos.
- Conversion failures remove the temporary file and expose only a retry/open
  error state.
- The bundled FFmpeg is GPLv3; its license and source notice ship in
  `resources/bin`.
- The read-only guard allowlist includes `modules/media/video-proxy.ts`.

## Changes made in Phase 6

- Replaced the broad `file://` IPC sender check with an exact packaged-document
  check and development-origin comparison.
- Removed `http://localhost:*` from `connect-src`; Vite HMR only needs the
  localhost WebSocket.
- Added `object-src`, `base-uri`, `form-action`, and `frame-src` restrictions.
- Added `scripts/check-read-only.mjs` to the quality gate.
- Added packaged verification of native/runtime binaries and checksums.
- Added CSP and trusted-sender tests.

## Residual risks and accepted limitations

- Builds are unsigned; Windows SmartScreen may warn. Code signing is a release
  decision outside v0.1.
- There is no auto-update channel; users install a new signed/unsigned package
  manually.
- Backup files are plaintext and inherit the user's filesystem permissions.
- Opening a file externally delegates security to the user's default Windows
  application.
- FFmpeg decodes local media files in a separate process. A maliciously crafted
  video is an additional native-code attack surface; the process runs with the
  user's permissions and writes only to the cache directory.
- Windows may update file access times when reading originals; this is
  documented but not suppressed in v0.1.
- Encrypted, corrupt, or permission-restricted files are skipped with explicit
  error/failed states rather than bypassed.
- A compromised local user account can read the catalog and backups. Memory Lane
  does not add at-rest encryption in v0.1.

## Verification

```powershell
npm run typecheck
npm run lint
npm run check:read-only
npm run test:coverage
npm run verify:package
npm run smoke:packaged
```

Manual review still required on a clean Windows VM: installer/uninstaller,
portable launch, codec playback, USB disconnect, and backup restore.
