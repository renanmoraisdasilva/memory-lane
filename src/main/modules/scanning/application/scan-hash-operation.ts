import { shouldUseQuickHash, type ScanHashPolicy } from "@shared/domain/hashing";
import type { Logger } from "../../../logging/types";
import type {
  FileHasher,
  HashSaveItem,
  PendingHashFile,
  QuickFileHasher,
} from "../domain/scan-files";

export interface HashOperationDependencies {
  hasher: FileHasher;
  quickHasher: QuickFileHasher | null;
  hashPolicy: ScanHashPolicy;
  logger: Logger;
}

export async function hashPendingFile(
  file: PendingHashFile,
  dependencies: HashOperationDependencies,
): Promise<HashSaveItem> {
  try {
    if (
      dependencies.quickHasher !== null &&
      shouldUseQuickHash(file.size, file.hasSizePeer, true, dependencies.hashPolicy)
    ) {
      const quick = await dependencies.quickHasher.hash(
        file.path,
        file.size,
        dependencies.hashPolicy.sampleBytes,
      );
      return {
        fileId: file.id,
        status: "complete",
        kind: "quick",
        algorithm: quick.algorithm,
        digest: quick.digest,
        sampleBytes: quick.sampleBytes,
        fileSize: file.size,
        modifiedAtFs: file.modifiedAtFs,
      };
    }
    const sha256 = await dependencies.hasher.hash(file.path);
    return { fileId: file.id, status: "complete", kind: "full", sha256 };
  } catch (error) {
    dependencies.logger.warn("Hash calculation failed", {
      path: file.path,
      message: error instanceof Error ? error.message : String(error),
    });
    return { fileId: file.id, status: "failed", sha256: "" };
  }
}
