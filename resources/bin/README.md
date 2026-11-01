# Native binaries

This directory is populated by `npm run fetch:binaries` from
`native-binaries.lock.json`.

The manifest is currently empty. ExifTool ships through the
`exiftool-vendored.exe` npm optional package and is unpacked from ASAR, not
through this directory.

FFmpeg is provided by the pinned `ffmpeg-static` package. Packaging copies its
executable, license, and source notice into `resources/bin` as extra resources.
See `docs/release/third-party-notices.md`.
