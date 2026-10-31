# Agent workstreams

Status: archived. This operating agreement applied to the parallel Phase 1-2
agent workstreams. The project now uses a single-agent/maintainer flow; the
document is kept for historical context.

Operating agreement for running coding agents on Memory Lane in parallel. It
complements `docs/product/scope-and-implementation.md` and the parent workspace
`AGENTS.md`.

## Principles

1. **Contract-first.** Define IPC and domain contracts before backend and
   renderer work diverge.
2. **Path ownership.** One agent owns a directory tree. Shared files have one
   nominated owner.
3. **Small, vertical slices.** Integrate something usable every one to two days.
4. **Green main.** No merge while the quality gate is red.
5. **Human review** for contracts, schema changes, dependencies, and architecture
   decisions.
6. **No agent pushes to `origin`.** Agents commit locally; the human reviews and
   pushes.

## Workstreams

| Workstream | Owns | Does not own |
|---|---|---|
| **Platform/Core** | `src/main/**`, `src/preload/**`, `src/main/db/**`, `src/main/workers/**`, `resources/bin`, `native-binaries.lock.json`, `electron-builder.yml` | Renderer features, E2E harness, scope decisions |
| **Renderer/UX** | `src/renderer/**`, renderer component tests | Main process, DB, contracts, packaging |
| **Quality/Release** | `.github/**`, `tests/e2e/**`, `tests/fixtures/**`, `scripts/**`, `vitest.config.ts`, `playwright.config.ts`, `docs/adr/**` | Product features, renderer internals, main-process internals |

Shared ownership:

- `src/shared/contracts/**` and `src/shared/domain/**` are authored by
  Platform/Core, reviewed by Renderer/UX, and approved by the human/architect.
- `package.json` and `package-lock.json` have one dependency steward at a time
  (Quality/Release if present, otherwise Platform/Core). Other agents request
  changes.
- `electron.vite.config.ts`, ESLint, TypeScript, and test configuration are owned
  by Quality/Release. Platform and Renderer request changes.
- `docs/product/scope-and-implementation.md`, `README.md`, and ADRs are
  human/architect-owned. Agents propose updates.
- `ui-mockups/` is a design reference. Do not modify it while implementing the
  app unless scope explicitly changes.

## Contract-first workflow

1. Platform defines Zod schemas, DTOs, error codes, and IPC channel names in
   `src/shared/contracts`.
2. Platform adds contract tests and a typed fake IPC adapter.
3. Renderer builds against fixtures through the real client seam; it does not
   wait for handlers and does not add a mock path to the production default.
4. Platform implements handlers against the same contract.
5. A contract change requires:
   - updated contract tests;
   - Platform and Renderer review;
   - human approval if it changes a released screen or the data model.
6. No process-boundary imports outside the approved contracts.

## Worktrees and branches

Each agent gets its own git worktree and branch. Use names that identify the
phase and workstream, for example:

```text
../memory-lane-platform-phase-3   agent/platform-phase-3
../memory-lane-renderer-phase-3   agent/renderer-phase-3
```

Rules:

- Start from the current `main`, not an older phase branch.
- Commit small, one-line messages.
- Rebase on `main` daily.
- Do not keep a branch alive for more than two days without integration.
- Do not push to `origin`.
- Run the quality gate before asking for integration.
- One agent owns `package.json` at a time.

## Shared-file rules

- Do not edit outside your owned paths without a coordinated change request.
- Do not refactor another workstream's files as a drive-by.
- If a shared file needs a change, its owner makes the change and the other
  agent consumes it.
- Dependency additions are small, reviewed changes handled by the dependency
  steward.
- Shared configuration changes are separate from feature work.
- If a contract or schema change is required, pause dependent work, update the
  contract, and resume both streams from the new version.

## Integration cadence

Suggested daily loop:

1. Agents rebase on `main`.
2. Agents run their local checks.
3. Contract changes are reviewed first.
4. Platform merges the backend slice.
5. Renderer merges the UI slice.
6. Quality runs E2E and packaging smoke.
7. The human reviews and pushes.

Merge order:

```text
contracts -> backend slice -> renderer slice -> tests/docs
```

A red `main` blocks all agents until fixed.

## Definition of done for an agent slice

- Owned code builds and typechecks.
- Tests at the right level are added or updated.
- Architecture boundaries, file size, and complexity pass.
- The read-only guarantee is preserved.
- The contract is unchanged or the change is approved.
- Documentation or an ADR is updated for a significant decision.
- The agent reports:
  - what changed;
  - what was tested;
  - what is blocked;
  - what the next agent needs to know.

## Agent prompt template

```text
You are the Platform/Core agent for Memory Lane.

Read:
- the parent workspace AGENTS.md
- docs/product/scope-and-implementation.md
- docs/product/roadmap.md
- docs/contracts/scan.md and docs/contracts/library.md as relevant
- docs/archive/agent-workstreams.md
- docs/product/scope-and-implementation.md, section 6.1, for quality exceptions

Workstream: Platform/Core
Worktree: ../memory-lane-platform-phase-N
Branch: agent/platform-phase-N

Own only:
- src/main/**
- src/preload/**
- src/main/db/**
- src/main/workers/**
- resources/bin
- native-binaries.lock.json
- electron-builder.yml

Do not edit:
- src/renderer/**
- tests/e2e/**
- shared contracts without review
- package.json without the dependency steward

Tasks:
<specific vertical slice>

Acceptance:
- tests at the right level
- typecheck, lint, file-size, and architecture checks pass
- no source-file mutation path
- report what changed, tested, blocked, and next

Do not push to origin.
```

## When not to parallelize

Do not split these across agents:

- Framework or build-system scaffolding.
- IPC contract design.
- Database schema and migration design.
- Shared configuration changes.
- Release packaging and signing decisions.
- A single screen that backend and renderer must design together.

These are short, high-leverage decisions and are faster with one owner plus
review.

## Escalation

Escalate to the human/architect when:

- A contract or schema change affects multiple workstreams.
- A dependency addition affects packaging or native modules.
- A feature starts to exceed the agreed scope.
- A quality exception is requested.
- Two agents need the same file at the same time.
- The read-only guarantee is in question.

The human decides, records the decision in an ADR or the scope document, and
then work resumes.
