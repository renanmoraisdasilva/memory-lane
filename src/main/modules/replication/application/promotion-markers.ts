import path from "node:path";
import { toVolumeId } from "@shared/contracts/drives";
import type { Logger } from "../../../logging/types";
import type { ReplicationDestinationRecord } from "../../../db/repositories/replication-destination-repository";
import type { DetectedDrive } from "../../drives/domain/drive";
import {
  createDestinationWriter,
  type DestinationWriter,
} from "../infrastructure/destination-writer";
import { writeMarker } from "../infrastructure/destination-marker";

export async function updatePromotionMarkers(input: {
  records: ReplicationDestinationRecord[];
  drives: DetectedDrive[];
  catalogId: string;
  sourceLabel: string;
  sourceVolumeId: string;
  now: string;
  logger: Logger;
  writerFor?: (rootPath: string) => DestinationWriter;
}): Promise<void> {
  const drivesByVolume = new Map(input.drives.map((drive) => [drive.volumeId, drive]));
  const writerFor = input.writerFor ?? createDestinationWriter;
  for (const record of input.records) {
    const drive = drivesByVolume.get(toVolumeId(record.volumeId));
    if (drive === undefined) {
      continue;
    }
    const root = record.rootRelative.trim().length
      ? path.resolve(drive.rootPath, record.rootRelative)
      : path.resolve(drive.rootPath);
    try {
      await writeMarker(writerFor(root), {
        schemaVersion: 1,
        catalogId: input.catalogId,
        destinationId: record.destinationId,
        sourceLabel: input.sourceLabel,
        sourceVolumeId: input.sourceVolumeId,
        rootRelative: record.rootRelative,
        copyRootRelative: record.copyRootRelative,
        replicaGoal: record.goal,
        replicaLayout: record.layout,
        localCatalogId: record.localCatalogId,
        localCatalogRelative: record.localCatalogRelative,
        sourceIndexRelative: record.sourceIndexRelative,
        updatedAt: input.now,
      });
    } catch (error) {
      input.logger.warn("Destination marker update failed after promotion", {
        destinationId: record.destinationId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
