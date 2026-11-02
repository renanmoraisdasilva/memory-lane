import type Database from "better-sqlite3";
import type {
  DuplicateCleanupFile as DuplicateCleanupFileContract,
  DuplicateCleanupGroup,
  DuplicateCleanupPlan,
  DuplicateCleanupSkipCounts,
  DuplicateCleanupSummary,
} from "@shared/contracts/health";
import {
  DUPLICATE_CLEANUP_KEEPER_RULE,
  DUPLICATE_CLEANUP_MINIMUM_FILE_SIZE,
  evaluateDuplicateGroup,
  type DuplicateCleanupDecision,
  type DuplicateCleanupFile,
  type DuplicateCleanupSkipReason,
} from "@shared/domain/duplicate-cleanup";

interface DuplicateCandidateRow {
  group_id: number;
  sha256: string;
  file_id: number;
  name: string;
  path: string;
  size: number;
  created_at_fs: string | null;
  modified_at_fs: string | null;
  link_count: number;
  has_verified_replica: number;
  has_date_override: number;
}

export interface DuplicateEvaluationGroup {
  groupId: number;
  sha256: string;
  files: DuplicateCleanupFile[];
  decision: DuplicateCleanupDecision;
}

const CANDIDATE_QUERY = `
  SELECT
    dg.id AS group_id,
    dg.sha256 AS sha256,
    f.id AS file_id,
    f.name AS name,
    f.path AS path,
    f.size AS size,
    f.created_at_fs AS created_at_fs,
    f.modified_at_fs AS modified_at_fs,
    f.link_count AS link_count,
    EXISTS(
      SELECT 1
      FROM replica_files rf
      JOIN replica_destinations d ON d.id = rf.replica_id
      WHERE rf.file_id = f.id
        AND rf.status = 'verified'
        AND d.status = 'active'
        AND rf.source_size_at_verify = f.size
        AND rf.source_modified_at_fs_at_verify IS f.modified_at_fs
    ) AS has_verified_replica,
    EXISTS(
      SELECT 1 FROM date_overrides o
      WHERE o.file_id = f.id AND o.reverted_at IS NULL
    ) AS has_date_override
  FROM duplicate_groups dg
  JOIN duplicate_members dm ON dm.group_id = dg.id
  JOIN files f ON f.id = dm.file_id
  WHERE f.state = 'present'
  ORDER BY dg.id ASC, f.id ASC
`;

function toCleanupFile(row: DuplicateCandidateRow): DuplicateCleanupFile {
  return {
    fileId: row.file_id,
    name: row.name,
    path: row.path,
    sizeBytes: row.size,
    createdAtFs: row.created_at_fs,
    modifiedAtFs: row.modified_at_fs,
    linkCount: row.link_count,
    hasVerifiedReplica: row.has_verified_replica === 1,
    hasDateOverride: row.has_date_override === 1,
  };
}

export function loadDuplicateEvaluations(
  db: Database.Database,
): Map<number, DuplicateEvaluationGroup> {
  const rows = db.prepare(CANDIDATE_QUERY).all() as DuplicateCandidateRow[];
  const groups = new Map<number, DuplicateEvaluationGroup>();
  for (const row of rows) {
    const file = toCleanupFile(row);
    const existing = groups.get(row.group_id);
    if (existing !== undefined) {
      existing.files.push(file);
      continue;
    }
    groups.set(row.group_id, {
      groupId: row.group_id,
      sha256: row.sha256,
      files: [file],
      decision: {
        keeper: file,
        keeperReason: "",
        eligible: false,
        skipReason: "not-a-group",
        excessBytes: 0,
      },
    });
  }

  for (const group of groups.values()) {
    const decision = evaluateDuplicateGroup(group.files);
    if (decision !== null) {
      group.decision = decision;
    }
  }
  return groups;
}

function emptySkipCounts(): DuplicateCleanupSkipCounts {
  return {
    notAGroup: 0,
    empty: 0,
    belowMinimumSize: 0,
    keeperNotCovered: 0,
    candidateDateOverride: 0,
    multipleDateOverrides: 0,
    hardLink: 0,
  };
}

function addSkip(skipCounts: DuplicateCleanupSkipCounts, reason: DuplicateCleanupSkipReason): void {
  switch (reason) {
    case "not-a-group":
      skipCounts.notAGroup += 1;
      return;
    case "empty":
      skipCounts.empty += 1;
      return;
    case "below-minimum-size":
      skipCounts.belowMinimumSize += 1;
      return;
    case "keeper-not-covered":
      skipCounts.keeperNotCovered += 1;
      return;
    case "candidate-date-override":
      skipCounts.candidateDateOverride += 1;
      return;
    case "multiple-date-overrides":
      skipCounts.multipleDateOverrides += 1;
      return;
    case "hard-link":
      skipCounts.hardLink += 1;
      return;
  }
}

export function summarizeDuplicateEvaluations(
  groups: Iterable<DuplicateEvaluationGroup>,
  rootPath: string,
  quarantineRoot: string,
): DuplicateCleanupSummary {
  const skipCounts = emptySkipCounts();
  let totalGroups = 0;
  let totalFiles = 0;
  let totalDuplicateBytes = 0;
  let eligibleGroups = 0;
  let filesToMove = 0;
  let bytesToMove = 0;

  for (const group of groups) {
    totalGroups += 1;
    totalFiles += group.files.length;
    totalDuplicateBytes += group.files.reduce((sum, file) => sum + file.sizeBytes, 0);
    if (!group.decision.eligible) {
      addSkip(skipCounts, group.decision.skipReason);
      continue;
    }
    eligibleGroups += 1;
    filesToMove += group.files.length - 1;
    bytesToMove += group.decision.excessBytes;
  }

  return {
    totalGroups,
    totalFiles,
    totalDuplicateBytes,
    eligibleGroups,
    skippedGroups: totalGroups - eligibleGroups,
    filesToMove,
    bytesToMove,
    keepers: eligibleGroups,
    skipCounts,
    minimumFileSizeBytes: DUPLICATE_CLEANUP_MINIMUM_FILE_SIZE,
    rootPath,
    quarantineRoot,
  };
}

function toContractFile(file: DuplicateCleanupFile): DuplicateCleanupFileContract {
  return {
    fileId: file.fileId,
    name: file.name,
    path: file.path,
    sizeBytes: file.sizeBytes,
    createdAtFs: file.createdAtFs,
    modifiedAtFs: file.modifiedAtFs,
  };
}

export function buildCleanupPlan(
  groups: Iterable<DuplicateEvaluationGroup>,
  rootPath: string,
  quarantineRoot: string,
): DuplicateCleanupPlan {
  const list = [...groups];
  const summary = summarizeDuplicateEvaluations(list, rootPath, quarantineRoot);
  const eligible: DuplicateCleanupGroup[] = [];
  for (const group of list) {
    if (!group.decision.eligible) {
      continue;
    }
    eligible.push({
      groupId: group.groupId,
      sha256: group.sha256,
      keeper: toContractFile(group.decision.keeper),
      candidates: group.files
        .filter((file) => file.fileId !== group.decision.keeper.fileId)
        .map(toContractFile),
      excessBytes: group.decision.excessBytes,
    });
  }
  return {
    rootPath,
    keeperRule: DUPLICATE_CLEANUP_KEEPER_RULE,
    summary,
    groups: eligible,
  };
}
