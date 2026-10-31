# Native binaries

This directory is populated by `npm run fetch:binaries` from
`native-binaries.lock.json`.

The manifest is currently empty. ExifTool ships through the
`exiftool-vendored.exe` npm optional package and is unpacked from ASAR, not
through this directory. If ffmpeg/ffprobe or another native tool is adopted in a
later phase, add pinned versions and SHA-256 checksums to the manifest, verify
them in the fetch script, and include license notices before shipping.
