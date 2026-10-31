# Security review

Status: Phase 6 automated review complete; clean-VM manual checks pending.

## Trust boundaries

| Boundary | Trust level | Control |
|---|---|---|
| Renderer to main process | Untrusted content, trusted origin | Context isolation, sandbox, typed preload, exact sender validation |
| Main process to SQLite | Trusted code only | Single DB worker, prepared statements, Zod validation |
| Main process to archive files | Read-only | No direct write APIs outside cache, logs, catalog, and backups |
| Media protocol to renderer | Catalog IDs only | `ml-media` resolves IDs through the DB worker; no raw paths |
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
  native SQLite module, ExifTool, and SHA-256 checksums.

## Files allowed to write

The read-only guard allowlist is intentionally small:

- catalog lock creation/removal;
- generated thumbnail files;
- generated cache deletion;
- SQLite catalog/app databases, logs, and backup copies (through their owning
  modules).

No module is allowed to write, rename, truncate, or delete an original archive
file.

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
