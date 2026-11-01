# Release checklist

Status: automated gates run locally; clean-VM, physical-drive, replication, and
codec playback checks pending.

## Automated gates

Run from the repository root with Node 22:

```powershell
npm run check:full
npm run package:win
npm run package:unpacked
npm run verify:package
npm run smoke:packaged
```

`verify:package` writes `release/SHA256SUMS.txt`. Verify it on the target
machine before installing:

```powershell
Get-FileHash release\Memory-Lane-Setup-0.1.0-x64.exe -Algorithm SHA256
Get-FileHash release\Memory-Lane-0.1.0-x64.exe -Algorithm SHA256
```

## 200,000-file performance pass

```powershell
$env:MEMORY_LANE_PERF_200K="1"
npm run test:perf
```

Record the result, real-drive duration, and approximate process memory in the
release notes. The default suite covers 100,000 files; both 100k and 200k
in-memory query passes are green.

## Clean Windows VM

1. Copy the installer, portable executable, and `SHA256SUMS.txt`.
2. Verify the SHA-256 hashes.
3. Install with the NSIS installer. Launch from the Start menu.
4. Confirm the app version and that no Node.js runtime is required.
5. Attach a fixture archive drive, create a catalog, and complete a scan.
6. Check Memory Lane, viewer navigation, Date unavailable, Library health,
   Other files, and Settings.
7. Run **Back up now**, close the app, and confirm the backup files exist.
8. Reopen the app and confirm the catalog and dates are intact.
9. Run **Clear generated cache**, confirm thumbnails regenerate, and confirm
   originals remain.
10. Uninstall from Windows Settings. Confirm program files are removed.
11. Run the portable executable and repeat the basic scan/open/close flow.
12. Record any SmartScreen or unsigned-binary warnings.

## USB disconnect drill

1. Attach a physical USB archive drive and start a scan.
2. Disconnect the drive mid-scan.
3. Confirm the scan reaches the error state with the disconnect message.
4. Reconnect the drive.
5. Resume the scan and confirm it completes.
6. Confirm the catalog still opens and no original was modified or deleted.

## Backup recovery drill

1. Create a catalog with at least one scanned file.
2. Run **Back up now**.
3. Close Memory Lane.
4. Move the live `catalog.db` and `app.db` aside.
5. Copy `catalog.db` and `app.db` from the backup directory into their original
   locations.
6. Reopen Memory Lane and verify the file, dates, health, and Settings data.
7. Delete the moved-aside databases only after verification.

## Replication release pass

1. Use a source archive and at least one physical destination drive.
2. Register and adopt the destination, review the plan, and run a partial copy.
3. Pause, resume, and stop a run; confirm verified files survive each transition.
4. Add a full-copy destination, run it to completion, and inspect the completion
   status and shortfall display.
5. Promote the full copy. Confirm the new source opens, the old source is
   demoted, and chosen destinations keep or retire as selected.
6. Before changing the new source, roll back and confirm the old source is active
   again.
7. Repeat a promotion, then change the new source (scan or date edit) and confirm
   rollback is refused.
8. Disconnect a destination during a run and confirm it is skipped, then
   reconnect and resume without duplicating verified files.

## Codec matrix

Use `codec-matrix.md`. Record each tested extension and whether it played,
showed a poster only, or fell back to external open.

## Real archive

Test a real 2 TB USB 3 archive:

- initial scan duration and memory;
- pause/resume/intensity;
- disconnect/reconnect;
- incremental scan after adding and removing files;
- 100,000+ item browsing and thumbnail scrolling;
- date overrides;
- duplicate and missing-file review;
- validation pause/resume;
- backup duration and disk usage.

## Sign-off

| Item | Automated | Manual | Notes |
|---|---|---|---|
| Quality gates | Yes | - | `check:full` |
| 100k performance | Yes | - | Automated test |
| 200k performance | Yes | Pending | In-memory pass; record real-drive memory |
| Disconnect/resume | Simulated | Pending | Physical USB |
| Unclean restart | Yes | Pending | Worker-level drill |
| Backup restore | Yes | Pending | Real drive backup |
| Packaged smoke | Yes | - | Scan, Other files, Settings, backup, cache |
| Installer/uninstaller | Verification only | Pending | Clean VM |
| Portable build | Launch smoke | Pending | Clean VM |
| Codec matrix | WMV/3GP packaged proxy smoke | Pending | Clean VM; HEIC packaged check available via `npm run validate:heic -- <photo.heic>` |
| Real 2 TB archive | - | Pending | Physical drive |
| Replication full copy/promotion | Yes | Pending | Physical destination drives; rollback and disconnect drills |
| Checksums | Yes | Pending | Target-machine verification |
