export const DUPLICATE_QUARANTINE_DIR = ".memorylane_quarantine";

export const DUPLICATE_CLEANUP_MINIMUM_FILE_SIZE = 1024;

export const DUPLICATE_CLEANUP_KEEPER_RULE = "oldest-created-then-shorter-path";

export const DUPLICATE_CLEANUP_SKIP_REASONS = [
  "not-a-group",
  "empty",
  "below-minimum-size",
  "candidate-date-override",
  "multiple-date-overrides",
  "hard-link",
] as const;

export type DuplicateCleanupSkipReason = (typeof DUPLICATE_CLEANUP_SKIP_REASONS)[number];

export interface DuplicateCleanupFile {
  fileId: number;
  name: string;
  path: string;
  sizeBytes: number;
  createdAtFs: string | null;
  modifiedAtFs: string | null;
  linkCount: number;
  hasVerifiedReplica: boolean;
  hasDateOverride: boolean;
}

interface DuplicateCleanupDecisionBase {
  keeper: DuplicateCleanupFile;
  keeperReason: string;
  excessBytes: number;
}

export interface EligibleDuplicateCleanupDecision extends DuplicateCleanupDecisionBase {
  eligible: true;
  skipReason: null;
}

export interface SkippedDuplicateCleanupDecision extends DuplicateCleanupDecisionBase {
  eligible: false;
  skipReason: DuplicateCleanupSkipReason;
}

export type DuplicateCleanupDecision =
  EligibleDuplicateCleanupDecision | SkippedDuplicateCleanupDecision;

function pathDepth(value: string): number {
  return value.split(/[\\/]+/).filter((part) => part.length > 0).length;
}

function compareNullableDate(left: string | null, right: string | null): number {
  if (left === right) {
    return 0;
  }
  if (left === null) {
    return 1;
  }
  if (right === null) {
    return -1;
  }
  return left < right ? -1 : 1;
}

function compareKeeper(left: DuplicateCleanupFile, right: DuplicateCleanupFile): number {
  const created = compareNullableDate(left.createdAtFs, right.createdAtFs);
  if (created !== 0) {
    return created;
  }
  const modified = compareNullableDate(left.modifiedAtFs, right.modifiedAtFs);
  if (modified !== 0) {
    return modified;
  }
  const leftDepth = pathDepth(left.path);
  const rightDepth = pathDepth(right.path);
  if (leftDepth !== rightDepth) {
    return leftDepth - rightDepth;
  }
  if (left.path.length !== right.path.length) {
    return left.path.length - right.path.length;
  }
  if (left.name.length !== right.name.length) {
    return left.name.length - right.name.length;
  }
  return left.fileId - right.fileId;
}

function chooseKeeper(files: DuplicateCleanupFile[]): DuplicateCleanupFile {
  const covered = files.filter((file) => file.hasVerifiedReplica);
  const pool = covered.length > 0 ? covered : files;
  return pool.reduce((best, file) => (compareKeeper(file, best) < 0 ? file : best));
}

export function chooseDuplicateKeeper(files: DuplicateCleanupFile[]): DuplicateCleanupFile | null {
  if (files.length === 0) {
    return null;
  }
  return chooseKeeper(files);
}

export function duplicateKeeperReason(
  files: DuplicateCleanupFile[],
  keeper: DuplicateCleanupFile,
): string {
  if (keeper.hasVerifiedReplica && files.some((file) => !file.hasVerifiedReplica)) {
    return "verified backup";
  }
  if (files.some((file) => compareNullableDate(file.createdAtFs, keeper.createdAtFs) !== 0)) {
    return "oldest created";
  }
  if (files.some((file) => compareNullableDate(file.modifiedAtFs, keeper.modifiedAtFs) !== 0)) {
    return "oldest modified";
  }
  if (files.some((file) => pathDepth(file.path) !== pathDepth(keeper.path))) {
    return "shallower path";
  }
  if (files.some((file) => file.path.length !== keeper.path.length)) {
    return "shorter path";
  }
  if (files.some((file) => file.name.length !== keeper.name.length)) {
    return "shorter name";
  }
  return "stable tiebreaker";
}

function totalBytes(files: DuplicateCleanupFile[]): number {
  return files.reduce((sum, file) => sum + file.sizeBytes, 0);
}

function skipDecision(
  keeper: DuplicateCleanupFile,
  files: DuplicateCleanupFile[],
  skipReason: DuplicateCleanupSkipReason,
): DuplicateCleanupDecision {
  return {
    keeper,
    keeperReason: duplicateKeeperReason(files, keeper),
    eligible: false,
    skipReason,
    excessBytes: Math.max(0, totalBytes(files) - keeper.sizeBytes),
  };
}

function ineligibleReason(
  files: DuplicateCleanupFile[],
  keeper: DuplicateCleanupFile,
): DuplicateCleanupSkipReason | null {
  if (files.length < 2) {
    return "not-a-group";
  }
  if (files.every((file) => file.sizeBytes === 0)) {
    return "empty";
  }
  if (files.some((file) => file.sizeBytes < DUPLICATE_CLEANUP_MINIMUM_FILE_SIZE)) {
    return "below-minimum-size";
  }
  if (files.some((file) => file.linkCount > 1)) {
    return "hard-link";
  }
  const overrides = files.filter((file) => file.hasDateOverride);
  if (overrides.length > 1) {
    return "multiple-date-overrides";
  }
  if (overrides.length === 1 && overrides[0]?.fileId !== keeper.fileId) {
    return "candidate-date-override";
  }
  return null;
}

export function evaluateDuplicateGroup(
  files: DuplicateCleanupFile[],
): DuplicateCleanupDecision | null {
  const keeper = chooseDuplicateKeeper(files);
  if (keeper === null) {
    return null;
  }
  const skipReason = ineligibleReason(files, keeper);
  if (skipReason !== null) {
    return skipDecision(keeper, files, skipReason);
  }
  return {
    keeper,
    keeperReason: duplicateKeeperReason(files, keeper),
    eligible: true,
    skipReason: null,
    excessBytes: Math.max(0, totalBytes(files) - keeper.sizeBytes),
  };
}
