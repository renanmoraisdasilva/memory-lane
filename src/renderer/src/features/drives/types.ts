import type { DriveInfo } from "@shared/contracts/drives";

export type DriveConnection = "connected" | "offline";

export interface PendingLetterChange {
  previousLetter: string;
  newLetter: string;
  previousRootPath: string;
  newRootPath: string;
}

/**
 * Renderer-facing drive shape. The Phase 0 contract only reports connected
 * volumes, so offline-registry and changed-letter details are supplied by the
 * Phase 1 mock adapter until Platform/Core extends the drive contract.
 */
export interface DriveSelectionItem extends DriveInfo {
  connection: DriveConnection;
  indexedItemCount: number | null;
  lastScanAt: string | null;
  pendingLetterChange: PendingLetterChange | null;
}

export function isSupportedDrive(drive: DriveInfo): boolean {
  return drive.isExternal && drive.driveType !== "unknown";
}

export function toDriveSelectionItem(drive: DriveInfo): DriveSelectionItem {
  return {
    ...drive,
    connection: "connected",
    indexedItemCount: null,
    // The Phase 0 drive contract exposes last-seen time, not last-scan time.
    lastScanAt: null,
    pendingLetterChange: null,
  };
}

export function driveLetterLabel(drive: DriveInfo): string {
  return drive.letter === null ? "Folder source" : drive.letter;
}

export function catalogStatusLabel(drive: DriveSelectionItem): string {
  if (drive.connection === "offline") {
    return "Catalog preserved";
  }
  switch (drive.catalogStatus) {
    case "ready":
      return "Catalog found";
    case "registered":
      return "Catalog registered";
    case "none":
      return "No catalog";
  }
}
