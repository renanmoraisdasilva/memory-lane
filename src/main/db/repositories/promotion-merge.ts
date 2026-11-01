import path from "node:path";
import type Database from "better-sqlite3";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import type { CatalogSummary } from "@shared/contracts/drives";
import type { PromotionOldSourceFate } from "@shared/contracts/replication/types";
import { readArchiveIdentity } from "./archive-identity-repository";
import { getCatalogSummary, readDriveIdentity } from "./catalog-repository";
import {
  findDestinationByDestinationId,
  type ReplicationDestinationRecord,
} from "./replication-destination-repository";
import { insertPromotion } from "./replication-promotion-repository";
import type { PromotionRecord } from "./replication-promotion-types";
import { mergePromotionCoverage } from "./promotion-coverage-merge";
import { mergeSourceFiles } from "./promotion-file-merge";
import { toSourceRelativePath } from "./replication-source-repository";

export interface MergePromotionInput {
  source: Database.Database;
  destination: Database.Database;
  sourceCatalogPath: string;
  destinationCatalogPath: string;
  destinationId: string;
  oldSourceFate: PromotionOldSourceFate;
  partialFates: Array<{ destinationId: string; keep: boolean }>;
  oldSourceFits: boolean;
  sourceSnapshotPath: string;
  destinationSnapshotPath: string;
  now: string;
  schemaVersion: number;
}

export interface MergePromotionResult {
  promotion: PromotionRecord;
  catalog: CatalogSummary;
  catalogId: string;
  newSourceRootRelative: string;
  oldSourceVolumeId: string;
  oldSourceLabel: string;
}

interface MergeFacts {
  sourceIdentity: ReturnType<typeof readArchiveIdentity>;
  oldDrive: ReturnType<typeof readDriveIdentity>;
  destinationIdentity: ReturnType<typeof readArchiveIdentity>;
  newDrive: ReturnType<typeof readDriveIdentity>;
  record: ReplicationDestinationRecord;
  destinationRoot: string;
  newSourceRoot: string;
  newSourceRootRelative: string;
  oldSourceRootRelative: string;
}

function catalogRoot(catalogPath: string): string {
  return path.dirname(path.dirname(catalogPath));
}

function normalizeRelative(value: string): string {
  return value.trim().length === 0 ? "" : path.normalize(value);
}

function relativeInside(root: string, absolutePath: string, label: string): string {
  const relative = path.relative(root, absolutePath);
  if (
    relative.length === 0 ||
    relative === ".." ||
    relative.startsWith("..\\") ||
    relative.startsWith("../") ||
    path.isAbsolute(relative)
  ) {
    throw new AppError(APP_ERROR_CODES.PROMOTION_FAILED, `${label} must stay inside its root`);
  }
  return relative;
}

function resolveFacts(input: MergePromotionInput): MergeFacts {
  const sourceIdentity = readArchiveIdentity(input.source);
  const oldDrive = readDriveIdentity(input.source);
  const destinationIdentity = readArchiveIdentity(input.destination);
  const newDrive = readDriveIdentity(input.destination);
  const record = findDestinationByDestinationId(input.source, input.destinationId);
  if (record === null) {
    throw new AppError(APP_ERROR_CODES.PROMOTION_BLOCKED, "The destination was not found");
  }
  if (record.goal !== "full_copy" || record.status !== "active") {
    throw new AppError(
      APP_ERROR_CODES.PROMOTION_BLOCKED,
      "Promotion requires an active full-copy destination",
    );
  }
  const destinationRoot = catalogRoot(input.destinationCatalogPath);
  const newSourceRoot =
    record.layout === "dedicated"
      ? path.resolve(destinationRoot, record.copyRootRelative ?? "")
      : destinationRoot;
  const newSourceRootRelative =
    newSourceRoot === destinationRoot
      ? ""
      : relativeInside(destinationRoot, newSourceRoot, "The new source root");
  return {
    sourceIdentity,
    oldDrive,
    destinationIdentity,
    newDrive,
    record,
    destinationRoot,
    newSourceRoot,
    newSourceRootRelative,
    oldSourceRootRelative: normalizeRelative(sourceIdentity.sourceRootRelative),
  };
}

function runDestinationMerge(
  input: MergePromotionInput,
  facts: MergeFacts,
): { promotion: PromotionRecord; files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  const promotion = input.destination.transaction(() => {
    const merged = mergeSourceFiles({
      source: input.source,
      destination: input.destination,
      newSourceRoot: facts.newSourceRoot,
      sourceRootRelative: facts.oldSourceRootRelative,
      sourceCatalogPath: input.sourceCatalogPath,
      promotedReplicaId: facts.record.id,
      toSourceRelative: (absolutePath) =>
        toSourceRelativePath(input.sourceCatalogPath, absolutePath, facts.oldSourceRootRelative),
    });
    files = merged.presentFiles;
    bytes = merged.presentBytes;
    mergePromotionCoverage({
      source: input.source,
      destination: input.destination,
      fileIdMap: merged.fileIdMap,
      promotedDestinationRowId: facts.record.id,
      promotedDestinationKey: facts.record.destinationId,
      oldDrive: {
        volumeId: facts.oldDrive.volumeId,
        serialNumber: facts.oldDrive.serialNumber,
        label: facts.oldDrive.label,
        fileSystem: facts.oldDrive.fileSystem,
      },
      oldCatalogId: facts.sourceIdentity.catalogId,
      oldSourceRootRelative: facts.oldSourceRootRelative,
      oldSourceFits: input.oldSourceFits,
      oldSourceFate: input.oldSourceFate,
      partialFates: input.partialFates,
      now: input.now,
    });
    updateDestinationIdentity(input, facts);
    clearTransientState(input.destination, facts.newSourceRoot, input.now);
    return insertPromotion(input.destination, {
      catalogId: facts.sourceIdentity.catalogId,
      fromVolumeId: facts.oldDrive.volumeId,
      toVolumeId: facts.newDrive.volumeId,
      status: "completed",
      startedAt: input.now,
      completedAt: input.now,
      rolledBackAt: null,
      fromSourceRootRelative: facts.oldSourceRootRelative,
      toSourceRootRelative: facts.newSourceRootRelative,
      sourceSnapshotPath: input.sourceSnapshotPath,
      destinationSnapshotPath: input.destinationSnapshotPath,
      verifiedFiles: files,
      verifiedBytes: bytes,
      shortfallFiles: 0,
      shortfallBytes: 0,
      errorMessage: null,
    });
  })();
  return { promotion, files, bytes };
}

function updateDestinationIdentity(input: MergePromotionInput, facts: MergeFacts): void {
  input.destination
    .prepare(
      `UPDATE drive_identity
       SET volume_id = ?, volume_serial = ?, label = ?, file_system = ?, catalog_schema = ?
       WHERE id = 1`,
    )
    .run(
      facts.newDrive.volumeId,
      facts.newDrive.serialNumber,
      facts.newDrive.label,
      facts.newDrive.fileSystem,
      input.schemaVersion,
    );
  input.destination
    .prepare(
      `UPDATE archive_identity
       SET catalog_id = ?, label = ?, role = 'source', previous_local_catalog_id = ?,
           source_catalog_id = NULL, source_label = NULL, source_root_relative = ?,
           library_scope = 'source_root', active_source_volume_id = ?, promoted_at = ?,
           demoted_at = NULL, last_indexed_at = NULL, schema_version = ?
       WHERE id = 1`,
    )
    .run(
      facts.sourceIdentity.catalogId,
      facts.sourceIdentity.label,
      facts.destinationIdentity.catalogId,
      facts.newSourceRootRelative,
      facts.newDrive.volumeId,
      input.now,
      input.schemaVersion,
    );
}

function clearTransientState(
  destination: Database.Database,
  newSourceRoot: string,
  now: string,
): void {
  destination.exec(`
    DELETE FROM scan_sessions;
    DELETE FROM validation_sessions;
    DELETE FROM scan_roots;
  `);
  destination
    .prepare("INSERT INTO scan_roots (path, enabled, created_at) VALUES (?, 1, ?)")
    .run(newSourceRoot, now);
}

function demoteSource(
  input: MergePromotionInput,
  facts: MergeFacts,
  counts: { files: number; bytes: number },
): void {
  input.source.transaction(() => {
    input.source
      .prepare(
        `UPDATE archive_identity
         SET role = 'demoted_source', source_catalog_id = ?, source_label = ?,
             active_source_volume_id = NULL, demoted_at = ?, schema_version = ?
         WHERE id = 1`,
      )
      .run(
        facts.sourceIdentity.catalogId,
        facts.sourceIdentity.label,
        input.now,
        input.schemaVersion,
      );
    insertPromotion(input.source, {
      catalogId: facts.sourceIdentity.catalogId,
      fromVolumeId: facts.oldDrive.volumeId,
      toVolumeId: facts.newDrive.volumeId,
      status: "completed",
      startedAt: input.now,
      completedAt: input.now,
      rolledBackAt: null,
      fromSourceRootRelative: facts.oldSourceRootRelative,
      toSourceRootRelative: facts.newSourceRootRelative,
      sourceSnapshotPath: input.sourceSnapshotPath,
      destinationSnapshotPath: input.destinationSnapshotPath,
      verifiedFiles: counts.files,
      verifiedBytes: counts.bytes,
      shortfallFiles: 0,
      shortfallBytes: 0,
      errorMessage: null,
    });
  })();
}

export function mergePromotion(input: MergePromotionInput): MergePromotionResult {
  const facts = resolveFacts(input);
  const merged = runDestinationMerge(input, facts);
  demoteSource(input, facts, merged);
  return {
    promotion: merged.promotion,
    catalog: getCatalogSummary(input.destination, input.destinationCatalogPath),
    catalogId: facts.sourceIdentity.catalogId,
    newSourceRootRelative: facts.newSourceRootRelative,
    oldSourceVolumeId: facts.oldDrive.volumeId,
    oldSourceLabel: facts.oldDrive.label,
  };
}
