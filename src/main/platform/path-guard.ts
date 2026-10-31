import path from "node:path";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";

function normalizeForComparison(value: string): string {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

export function isPathInside(rootPath: string, candidatePath: string): boolean {
  const root = normalizeForComparison(rootPath);
  const candidate = normalizeForComparison(candidatePath);
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function assertPathInside(rootPath: string, candidatePath: string): void {
  if (!isPathInside(rootPath, candidatePath)) {
    throw new AppError(APP_ERROR_CODES.FORBIDDEN, "Path is outside the allowed root", {
      rootPath,
      candidatePath,
    });
  }
}
