## Summary

<!-- What changed and why? Link the relevant scope or ADR section. -->

## Verification

- [ ] `npm run check`
- [ ] Unit and component tests
- [ ] Integration tests (if main-process, SQLite, or filesystem behavior changed)
- [ ] E2E tests (if a user journey or process boundary changed)
- [ ] Packaged-app smoke test (if packaging, native modules, or binaries changed)

## Quality gates

- [ ] Files are at or below 400 lines; functions are at or below 100 lines
- [ ] Cyclomatic complexity is at most 10; cognitive complexity is at most 15
- [ ] No blanket ESLint disables; exceptions follow `docs/quality-exceptions.md`
- [ ] New IPC channels have Zod schemas and contract tests
- [ ] Coverage floors still pass
- [ ] No new `any`, floating promise, or unchecked external data

## Read-only guarantee

- [ ] No new source-file mutation path
- [ ] Reveal/open actions resolve catalog-owned paths in the main process
- [ ] Writable roots remain limited to app-managed locations
- [ ] Tests cover the read-only boundary where relevant

## Documentation

- [ ] Scope, screen requirements, or ADR updated for a significant decision
- [ ] User-facing behavior is described accurately
- [ ] Screenshots or prototype links included for UI changes
