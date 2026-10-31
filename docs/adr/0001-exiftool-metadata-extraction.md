# 0001 - ExifTool for metadata extraction

- Status: Accepted
- Date: 2026-10-31

## Context

Phase 3 needs capture dates from phone photos, camera files, and legacy
camcorder video. The archive also has a future Places feature that depends on
GPS metadata. A dependency-free reader would cover common JPEG/MP4 cases but
would leave HEIC, RAW, XMP-heavy files, and many legacy containers to
filesystem-date fallbacks.

## Decision

Use ExifTool 13.60 through `exiftool-vendored` as the primary metadata
extractor.

- Run it as a persistent child process with a maximum of two processes.
- Read group-prefixed tags so EXIF, XMP, QuickTime, RIFF/AVI, and Matroska dates
  are distinguishable.
- Keep the existing image-dimension and MP4/MOV duration readers as fallbacks.
- Unpack the platform binary from ASAR and verify it in the packaged smoke test.
- Extract selected fields only: dates, dimensions, duration, camera, codec, GPS,
  and provenance.

## Alternatives

- **Hand-rolled EXIF/MP4 reader.** No binary, but repeated work for JPEG/TIFF
  IFDs, HEIC boxes, XMP, timezone offsets, and legacy video containers. High risk
  of date errors.
- **Pure-JS `exifr`/ExifReader.** Lower packaging cost and fast, but no broad
  video/RAW coverage; the archive goals would eventually need another extractor
  and probably a second metadata pass.
- **ffprobe/ffmpeg only.** Good for video, weaker for photo EXIF/XMP and GPS.

## Consequences

Easier:

- One extractor covers common photos, RAW, and legacy video metadata.
- GPS can be captured during Phase 3 even though Places arrives later.
- The date priority chain and suspicious-date handling have richer inputs.

Harder:

- The installer grows by roughly 35 MB.
- The binary must be pinned, unpacked from ASAR, and verified after packaging.
- ExifTool adds child-process lifecycle, timeout, and shutdown behavior.
- A mixed-corpus benchmark is required before fixing concurrency.
- ExifTool does not make unsupported codecs playable or generate thumbnails for
  them; ffmpeg remains a separate decision.
