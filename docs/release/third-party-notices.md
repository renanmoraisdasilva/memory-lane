# Third-party notices

## FFmpeg

Memory Lane bundles a Windows FFmpeg executable for compatible video playback.

- Version: 6.1.1 essentials build from `www.gyan.dev`
- Package source: `ffmpeg-static` 5.3.0
- License: GPL v3
- Source code: <https://github.com/FFmpeg/FFmpeg/commit/e38092ef93>
- Shipped files: `resources/bin/ffmpeg.exe`, `resources/bin/ffmpeg.exe.LICENSE`,
  and `resources/bin/ffmpeg.exe.README`

The binary is invoked as a separate process. It reads the original video and
writes only a temporary MP4 under the Memory Lane cache directory. The archive
source is never modified.
