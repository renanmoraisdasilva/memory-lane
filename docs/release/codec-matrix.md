# Codec matrix

Status: classification and fallback behavior are automated; playback results
need a manual pass on the release Windows VM.

Memory Lane always catalogs the file and attempts metadata/thumbnail extraction.
In-app playback depends on Chromium/Electron plus Windows codecs. When playback
or display fails, the viewer shows a clear fallback with **Open externally**.
The original file is never modified.

## Images

| Extension | Catalog class | Thumbnail attempt | In-app display expectation | Fallback |
|---|---|---|---|---|
| `jpg`, `jpeg` | image | Windows shell / Electron | Supported | Open externally |
| `png` | image | Windows shell / Electron | Supported | Open externally |
| `gif` | image | Windows shell / Electron | Supported; animation depends on Chromium | Open externally |
| `bmp` | image | Windows shell / Electron | Supported | Open externally |
| `webp` | image | Windows shell / Electron | Supported | Open externally |
| `avif` | image | Windows shell / Electron | Expected on current Chromium | Open externally |
| `tif`, `tiff` | image | Windows shell only | Not generally rendered by Chromium | Open externally |
| `heic`, `heif` | image | Windows HEIF extension if installed | On-demand JPEG preview generated in a worker and cached | Open externally |
| `cr2`, `cr3`, `nef`, `arw`, `dng`, `orf`, `rw2`, `raf`, `srw`, `pef` | image | Windows RAW codec if installed | Not rendered by Chromium | Open externally |

## Video

| Extension | Catalog class | Thumbnail attempt | In-app playback expectation | Fallback |
|---|---|---|---|---|
| `mp4`, `m4v` | video | Windows shell / poster | H.264/AAC expected; HEVC only with OS codec support | Open externally |
| `mov` | video | Windows shell / poster | H.264/AAC may play; other codecs depend on OS | Open externally |
| `webm` | video | Windows shell / poster | VP8/VP9/Opus expected | Open externally |
| `mkv` | video | Windows shell / poster | Often unsupported by stock Chromium | Open externally |
| `avi` | video | Windows shell / poster | Generally unsupported | Open externally |
| `wmv` | video | Windows shell / poster | Generally unsupported | Open externally |
| `mpg`, `mpeg` | video | Windows shell / poster | Generally unsupported | Open externally |
| `3gp` | video | Windows shell / poster | Device/codec dependent | Open externally |
| `mts`, `m2ts` | video | Windows shell / poster | Generally unsupported | Open externally |

## Other files

Documents, spreadsheets, presentations, PDFs, audio, archives, and unknown
extensions are cataloged under Other files and are always opened externally.
There is no in-app document/PDF/audio viewer in v0.1.

## Manual pass

On a clean Windows release VM:

1. Create one short fixture for each video extension available.
2. Open it in the viewer and record whether it plays, shows only a poster, or
   falls back.
3. Do the same for one image per extension group.
4. Confirm every failed case still shows the catalog metadata and the
   **Open externally** action.
5. Record the results in the release checklist.

For HEIC/HEIF, run the packaged-app check against a real iPhone photo:

```bash
npm run validate:heic -- "C:\path\to\photo.heic"
```

It scans a temporary catalog, opens the photo, waits for the generated JPEG
preview to render, and verifies the cached file exists.

Supported results are not claimed until that pass is complete.
