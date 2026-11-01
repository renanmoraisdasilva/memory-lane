import type { FullCopyStatus } from "@shared/contracts/replication/types";
import type { SourceFileFacts } from "./replication-types";

export interface FullCopyEvaluation {
  status: FullCopyStatus;
  remainingFiles: number;
  remainingBytes: number;
  shortfallFiles: number;
  shortfallBytes: number;
}

export function evaluateFullCopy(input: {
  sourceFiles: SourceFileFacts[];
  verifiedFileIds: ReadonlySet<number>;
  availableBytes: number;
  staleFiles: number;
  missingFiles: number;
  conflictFiles: number;
}): FullCopyEvaluation {
  const remaining = input.sourceFiles.filter((file) => !input.verifiedFileIds.has(file.id));
  let available = input.availableBytes;
  let assignedFiles = 0;
  let assignedBytes = 0;
  for (const file of remaining) {
    if (file.size > available) {
      continue;
    }
    available -= file.size;
    assignedFiles += 1;
    assignedBytes += file.size;
  }
  const remainingBytes = remaining.reduce((total, file) => total + file.size, 0);
  const shortfallFiles = remaining.length - assignedFiles;
  const shortfallBytes = remainingBytes - assignedBytes;
  const issues = input.staleFiles + input.missingFiles + input.conflictFiles;
  const complete =
    input.sourceFiles.length > 0 && remaining.length === 0 && issues === 0 && shortfallBytes === 0;
  return {
    status: complete ? "complete" : "incomplete",
    remainingFiles: remaining.length,
    remainingBytes,
    shortfallFiles,
    shortfallBytes,
  };
}
