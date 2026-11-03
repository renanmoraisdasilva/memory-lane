# Other files contract

Status: implemented in Phase 5. Types live in
`src/shared/contracts/other-files.ts`.

## Routes

| Route | Purpose |
|---|---|
| `/files` | Category browser for non-media catalog files |

## IPC contract

| Channel | Method | Params | Result |
|---|---|---|---|
| `library:get-other-files` | `getOtherFiles` | `{ category?, offset?, limit? }` | `OtherFilesPage` |

`Open` and `Reveal` reuse `shell:open-item` and `shell:reveal-item` with a
catalog file ID.

## Scope

- `media_class = 'other'` rows only.
- Missing files are included and marked with `state: "missing"`.
- Categories: `all`, `documents`, `spreadsheets`, `presentations`, `pdfs`,
  `audio`, `archives`, `other`.
- Category is derived from the stored extension, case-insensitively.
- Ordering is `name COLLATE NOCASE`, then file ID.
- Default page size is 50; maximum is 200.
- `counts` always reports the full category totals regardless of the selected
  category or page.

## Actions

- Present files can be opened externally or revealed in Explorer.
- Missing files disable both actions.
- The app never deletes, edits, or renames an original. The only file-moving
  operation is the confirmed duplicate quarantine mover.
- No in-app document, PDF, or audio viewer is part of v0.1.

## Tests

Repository, handler, DB-worker integration, renderer, and Electron E2E tests
cover category counts, filters, pagination, missing state, open/reveal, and the
Other files route.
