# Architecture decision records

Architecture decision records capture significant technical decisions and why
they were made. They are short: context, decision, alternatives, consequences,
and status.

## Status values

- **Proposed** - under review.
- **Accepted** - current direction.
- **Superseded** - replaced by a later ADR.
- **Deprecated** - no longer recommended.

## Current records

- `0001-exiftool-metadata-extraction.md` - ExifTool as the primary Phase 3
  metadata extractor, with in-process readers as fallbacks.
- `0002-whole-catalog-integrity.md` - All-file duplicates, whole-catalog
  validation, rehash-and-update, and defensive moved confirmation.
- `0003-scheduled-backups-and-cache.md` - SQLite online backups every 15
  minutes and on close, plus all-or-nothing generated-cache clearing.
- `0004-heic-preview-conversion.md` - Worker-thread HEIC/HEIF to JPEG previews
  cached as generated media, with external-open fallback.
- `0005-versioned-metadata-extraction.md` - Extractor version stamps, stale
  detection, and the Memory Lane refresh banner.
- `0006-adopt-existing-partial-backups.md` - Accepted adoption-first workflow
  for existing manual copies spread across smaller destination drives.
- `0007-promote-full-copy-to-source.md` - Accepted full-copy destination goal
  and guided promotion of a verified copy into the new source archive.
- `0008-replication-implementation-boundaries.md` - Accepted process, catalog,
  workload, write-boundary, and API decisions for implementing replication.

Other implemented decisions are summarized in
`../product/scope-and-implementation.md`.

Create an ADR when a decision is significant, cross-cutting, and likely to be
questioned later. Do not create one for routine implementation detail.

## Template

```markdown
# NNNN - Title

- Status: Proposed | Accepted | Superseded | Deprecated
- Date: YYYY-MM-DD

## Context

What problem or constraint forced a decision?

## Decision

What was decided?

## Alternatives

What else was considered, and why was it rejected?

## Consequences

What becomes easier, harder, or constrained?
```
