import type { SourceFileFacts } from "./replication-types";

function pathKey(file: SourceFileFacts): string {
  return file.sourceRelativePath.toLowerCase();
}

/**
 * Library chronology: dated files first, ascending; undated files last; path
 * breaks ties case-insensitively.
 */
export function compareSourceChronology(left: SourceFileFacts, right: SourceFileFacts): number {
  if (left.resolvedDate === null && right.resolvedDate !== null) {
    return 1;
  }
  if (left.resolvedDate !== null && right.resolvedDate === null) {
    return -1;
  }
  if (left.resolvedDate !== null && right.resolvedDate !== null) {
    const byDate = left.resolvedDate.localeCompare(right.resolvedDate);
    if (byDate !== 0) {
      return byDate;
    }
  }
  return pathKey(left).localeCompare(pathKey(right));
}

export function sortSourceChronology(files: SourceFileFacts[]): SourceFileFacts[] {
  return [...files].sort(compareSourceChronology);
}
