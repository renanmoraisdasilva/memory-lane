# 0004 - On-demand HEIC/HEIF JPEG previews

- Status: Accepted
- Date: 2026-10-31

## Context

Chromium does not decode HEIC/HEIF images on Windows, so the viewer could only
fall back to **Open externally** for iPhone photos. The Windows HEIF extension
can supply shell thumbnails, but it does not make the full-size image available
to an Electron `<img>` element. The archive needs in-app viewing without
modifying originals or requiring a platform codec install.

## Decision

- Convert HEIC/HEIF to JPEG on demand when `ml-media://media/<fileId>` is
  requested for one of those files.
- Use `heic-convert` (libheif-js plus pure-JavaScript JPEG/PNG encoders).
- Run conversion in a dedicated worker thread so decoding does not block the
  main process or the window.
- Write the result to
  `.memorylane/cache/previews/<fileId>.jpg` and record it in `cache_entries`
  with `kind = 'preview'`.
- Deduplicate in-flight conversions per output path and return the cached JPEG
  on later requests.
- Treat conversion failure like other unsupported media: return 404 so the
  viewer shows the existing **Open externally** fallback.
- Clear previews with the rest of the generated cache. Scan invalidation already
  deletes all cache rows for a changed file.
- Keep thumbnails on the existing Windows-shell/Electron path.

## Alternatives

- **Use a large Windows shell thumbnail as the full preview.** Simple, but the
  shell thumbnail is size-limited and not a faithful full-resolution view.
- **Bundle ffmpeg/libheif native binaries.** Broader format coverage, but a much
  larger packaging and codec-support burden than this focused feature needs.
- **Convert on the main thread.** Fewer moving parts, but a 12 MP HEIC decode
  can block the UI for seconds; the worker keeps the window responsive.
- **Require the Windows HEIF extension.** It already helps thumbnails, but it
  does not solve in-app rendering for Chromium.
- **Leave HEIC external-only.** Safe, but poor for iPhone-heavy archives.

## Consequences

- The package grows by roughly the `libheif-js` JavaScript payload (about 9 MB
  unpacked).
- First open of a HEIC photo costs CPU time; later opens are served from the
  cached JPEG.
- Preview files add generated-cache usage and are removed by **Clear cache**.
- HEIC remains read-only: the original file is only read by the worker.
- The manual codec matrix pass must include a real iPhone HEIC photo on the
  release Windows VM.
