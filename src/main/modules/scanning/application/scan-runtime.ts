import type { ScanIntensity, ScanStageId, ScanState } from "@shared/contracts/scan";
import type { VolumeId } from "@shared/contracts/drives";
import type { DbClient } from "../../../clients/db-client";
import type { Logger } from "../../../logging/types";
import type {
  FileHasher,
  FileMetadataExtractor,
  ThumbnailWorkScheduler,
} from "../domain/scan-files";

export interface ScanRuntime {
  db: DbClient;
  volumeId: VolumeId;
  rootPath: string;
  cachePath: string;
  logger: Logger;
  metadata: FileMetadataExtractor;
  thumbnails: ThumbnailWorkScheduler;
  hasher: FileHasher;
  now: () => Date;
  delay: (milliseconds: number) => Promise<void>;
  checkpoint: () => Promise<void>;
  publish: (state: ScanState) => void;
  getIntensity: () => ScanIntensity;
}

export interface ProgressUpdate {
  state: ScanState;
  stageId: ScanStageId;
  processed: number;
  total: number | null;
  etaSeconds: number | null;
}
