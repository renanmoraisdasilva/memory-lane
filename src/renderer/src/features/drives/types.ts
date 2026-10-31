import type { DriveInfo } from "@shared/contracts/drives";
import { catalogPathForRoot } from "../../lib/drive-paths";

export type DriveConnection = "connected" | "offline";

export interface PendingLetterChange {
  previousLetter: string;
  newLetter: string;
  previousRootPath: string;
  newRootPath: string;
}

/**
 * Renderer-facing drive shape. Platform supplies connectivity, last-scan stats,
 * and the changed-letter flag; the renderer adds the catalog-path comparison it
 * needs for the confirmation dialog.
 */
export interface DriveSelectionItem extends DriveInfo {
  connection: DriveConnection;
  indexedItemCount: number | null;
  lastScanAt: string | null;
  pendingLetterChange: PendingLetterChange | null;
}

function pendingLetterChange(drive: DriveInfo): PendingLetterChange | null {
  if (
    drive.isConnected === false ||
    drive.requiresLetterConfirmation !== true ||
    drive.letter === null ||
    drive.lastLetter === null ||
    drive.lastLetter === undefined ||
    drive.letter === drive.lastLetter
  ) {
    return null;
  }

  return {
    previousLetter: drive.lastLetter,
    newLetter: drive.letter,
    previousRootPath: catalogPathForRoot(`${drive.lastLetter}\\`),
    newRootPath: catalogPathForRoot(drive.rootPath),
  };
}

export function isSupportedDrive(drive: DriveInfo): boolean {
  return drive.isExternal && drive.driveType !== "unknown";
}

export function toDriveSelectionItem(drive: DriveInfo): DriveSelectionItem {
  return {
    ...drive,
    connection: drive.isConnected === false ? "offline" : "connected",
    indexedItemCount: drive.indexedFiles ?? null,
    lastScanAt: drive.lastScanAt ?? null,
    pendingLetterChange: pendingLetterChange(drive),
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
