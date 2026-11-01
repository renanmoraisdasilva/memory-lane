# 0009 - Bundle FFmpeg for compatible video playback

- Status: Accepted
- Date: 2026-11-01

## Context

Memory Lane catalogs WMV and 3GP files but plays video through Chromium's
`<video>` element. Chromium does not include WMV/VC-1/WMA decoders, and 3GP
files often contain codecs Chromium cannot decode. The current fallback is
**Open externally**, which leaves the two formats without in-app playback.

The archive is read-only. Converting an original in place is not acceptable.

## Decision

Bundle a static FFmpeg build as a packaged resource and generate an on-demand
H.264/AAC MP4 compatible copy for unsupported videos.

- WMV and 3GP start preparation immediately in the viewer.
- Other videos try direct playback first and start preparation on error.
- One background FFmpeg child process runs per file. The viewer polls progress.
- Output is written to a temporary file under `.memorylane/cache/proxies` and
  renamed into place only after FFmpeg succeeds.
- A `cache_entries` row of kind `proxy` stores the source size and modified
  time, status, byte count, and error message. Source changes invalidate it
  through the normal scan cache invalidation.
- `ml-media://proxy/<fileId>` serves the cached MP4 with byte-range support.
- Proxy files are included in Settings cache size and cache clearing.
- If conversion fails, the viewer offers retry and external open.

## Alternatives considered

- **Native Media Foundation decoder.** Windows-specific and significantly more
  code than bundling FFmpeg.
- **Embedded VLC/libVLC.** Much larger integration and licensing surface.
- **Transcode on the fly with streaming/seek-while-converting.** Better first
  playback latency, but substantially more complex than a cached proxy.
- **External player only.** No new dependency, but does not provide in-app
  playback.
- **In-place conversion.** Rejected because source archives are read-only.

## Consequences

- The Windows package grows by roughly 83 MB and includes a GPLv3 FFmpeg binary.
  The license and source notice ship beside the executable.
- First playback of an unsupported video waits for conversion; later playback
  uses the cache.
- Proxies consume cache space and are visible in the existing cache controls.
- FFmpeg is invoked as a separate process with an argument array. It never
  receives write access to the source path.
- The read-only allowlist includes the video proxy writer.

## Manual validation

Use the codec matrix release pass on a real Windows VM with WMV and at least one
3GP file. Confirm preparation progress, successful playback, cache reuse, cache
clearing, source-change regeneration, and external-open fallback on failure.
