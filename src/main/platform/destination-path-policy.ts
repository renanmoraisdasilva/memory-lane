import path from "node:path";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import { assertPathInside } from "./path-guard";

function comparatorValue(value: string): string {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

export function relativePathKey(value: string): string {
  return path.win32.normalize(value.replaceAll("/", "\\")).toLowerCase();
}

export function assertRelativePath(value: string, label = "Path"): string {
  if (value.trim().length === 0) {
    throw new AppError(APP_ERROR_CODES.INVALID_REQUEST, `${label} must not be empty`);
  }
  const normalized = path.win32.normalize(value.replaceAll("/", "\\"));
  if (
    normalized.length === 0 ||
    path.win32.isAbsolute(normalized) ||
    path.posix.isAbsolute(normalized) ||
    normalized === ".." ||
    normalized.startsWith("..\\")
  ) {
    throw new AppError(APP_ERROR_CODES.INVALID_REQUEST, `${label} must stay inside its root`, {
      value,
    });
  }
  return normalized;
}

export function resolveRelativePath(root: string, relativePath: string): string {
  const relative = assertRelativePath(relativePath);
  const resolved = path.resolve(root, relative);
  assertPathInside(root, resolved);
  return resolved;
}

export function assertNoRootOverlap(sourceRoot: string, destinationRoot: string): void {
  const source = comparatorValue(sourceRoot);
  const destination = comparatorValue(destinationRoot);
  const sourceInsideDestination =
    destination === source ||
    source.startsWith(destination.endsWith(path.sep) ? destination : `${destination}${path.sep}`);
  const destinationInsideSource =
    source === destination ||
    destination.startsWith(source.endsWith(path.sep) ? source : `${source}${path.sep}`);

  if (sourceInsideDestination || destinationInsideSource) {
    throw new AppError(
      APP_ERROR_CODES.DESTINATION_OVERLAP,
      "The source and destination roots must not overlap",
      { sourceRoot, destinationRoot },
    );
  }
}

export function assertDifferentVolume(sourceVolumeId: string, destinationVolumeId: string): void {
  if (sourceVolumeId === destinationVolumeId) {
    throw new AppError(
      APP_ERROR_CODES.DESTINATION_OVERLAP,
      "A destination cannot be on the same volume as the source archive",
      { sourceVolumeId, destinationVolumeId },
    );
  }
}
