import type { DetectedDrive } from "../../drives/domain/drive";
import type {
  FileHasher,
  FileMetadataExtractor,
  QuickFileHasher,
  ThumbnailWorkScheduler,
} from "../domain/scan-files";
import type { ScanHashPolicy } from "@shared/domain/hashing";
import type { DbClient } from "../../../clients/db-client";
import type { Logger } from "../../../logging/types";
import type { WorkloadCoordinator } from "../../workloads/application/workload-coordinator";

export interface ScanServiceDependencies {
  db: DbClient;
  listDetected: () => Promise<DetectedDrive[]>;
  logger: Logger;
  metadata: FileMetadataExtractor;
  thumbnails: ThumbnailWorkScheduler;
  hasher: FileHasher;
  quickHasher?: QuickFileHasher;
  hashPolicy?: ScanHashPolicy;
  workloads?: WorkloadCoordinator;
  now?: () => Date;
  sleep?: (milliseconds: number) => Promise<void>;
  batchDelayMs?: number;
  checkDriveAvailable?: (rootPath: string) => Promise<void>;
}
