import { appendFile, lstat, mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  DuplicateCleanupFile,
  DuplicateCleanupGroup,
  DuplicateCleanupMove,
  DuplicateCleanupPlan,
} from "@shared/contracts/health";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import type { FileHasher } from "../../scanning/domain/scan-files";
import { assertPathInside } from "../../../platform/path-guard";

const SYSTEM_DIRECTORIES = new Set([".memorylane", ".memorylane_quarantine"]);

export type CleanupSourceState = "ok" | "missing" | "changed" | "hard-link" | "outside-root";

export interface QuarantinePrepareInput {
  plan: DuplicateCleanupPlan;
  runId: number;
  quarantinePath: string;
  journalPath: string;
  startedAt: string;
}

export interface QuarantineMoveResult {
  move: DuplicateCleanupMove | null;
  skipReason: string | null;
}

interface JournalEntry {
  type:
    | "run-started"
    | "run-finished"
    | "group-skipped"
    | "file-moved"
    | "file-skipped"
    | "file-restored"
    | "file-restore-failed";
  at: string;
  runId: number;
  groupId?: number;
  fileId?: number;
  path?: string;
  destination?: string;
  reason?: string;
  detail?: string;
}

function isSystemRelativePath(relativePath: string): boolean {
  const first = relativePath.split(/[\\/]+/)[0]?.toLowerCase();
  return first !== undefined && SYSTEM_DIRECTORIES.has(first);
}

function uniqueSuffix(target: string, index: number): string {
  const extension = path.extname(target);
  const base = target.slice(0, target.length - extension.length);
  return `${base}.${index}${extension}`;
}

export class QuarantineMover {
  private journalPath: string | null = null;
  private runId = 0;

  constructor(private readonly hasher: FileHasher) {}

  async prepare(input: QuarantinePrepareInput): Promise<void> {
    assertPathInside(input.plan.summary.quarantineRoot, input.quarantinePath);
    assertPathInside(input.plan.rootPath, input.quarantinePath);
    this.journalPath = input.journalPath;
    this.runId = input.runId;

    await mkdir(input.quarantinePath, { recursive: true });
    await writeFile(
      path.join(input.quarantinePath, "manifest.json"),
      `${JSON.stringify(
        {
          version: 1,
          startedAt: input.startedAt,
          keeperRule: input.plan.keeperRule,
          rootPath: input.plan.rootPath,
          quarantinePath: input.quarantinePath,
          summary: input.plan.summary,
          groups: input.plan.groups,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await this.append({
      type: "run-started",
      at: input.startedAt,
      runId: this.runId,
      detail: input.plan.keeperRule,
    });
  }

  async inspectSource(file: DuplicateCleanupFile, sha256: string): Promise<CleanupSourceState> {
    const source = path.resolve(file.path);
    try {
      const stats = await lstat(source);
      if (!stats.isFile()) {
        return "missing";
      }
      if (stats.size !== file.sizeBytes) {
        return "changed";
      }
      if (stats.nlink > 1) {
        return "hard-link";
      }
      const actual = await this.hasher.hash(source);
      return actual === sha256 ? "ok" : "changed";
    } catch {
      return "missing";
    }
  }

  async move(input: {
    group: DuplicateCleanupGroup;
    candidate: DuplicateCleanupFile;
    runRootPath: string;
    quarantinePath: string;
    movedAt: string;
  }): Promise<QuarantineMoveResult> {
    const source = path.resolve(input.candidate.path);
    let relativePath: string;
    try {
      assertPathInside(input.runRootPath, source);
      relativePath = path.relative(input.runRootPath, source);
    } catch {
      await this.appendSkip({
        groupId: input.group.groupId,
        file: input.candidate,
        reason: "outside-root",
        at: input.movedAt,
      });
      return { move: null, skipReason: "outside-root" };
    }
    if (relativePath.length === 0 || isSystemRelativePath(relativePath)) {
      await this.appendSkip({
        groupId: input.group.groupId,
        file: input.candidate,
        reason: "outside-root",
        at: input.movedAt,
      });
      return { move: null, skipReason: "outside-root" };
    }

    const state = await this.inspectSource(input.candidate, input.group.sha256);
    if (state !== "ok") {
      await this.appendSkip({
        groupId: input.group.groupId,
        file: input.candidate,
        reason: state,
        at: input.movedAt,
      });
      return { move: null, skipReason: state };
    }

    const destination = await this.uniqueDestination(path.join(input.quarantinePath, relativePath));
    assertPathInside(input.quarantinePath, destination);
    await mkdir(path.dirname(destination), { recursive: true });

    try {
      await rename(source, destination);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      await this.appendSkip({
        groupId: input.group.groupId,
        file: input.candidate,
        reason: "rename-failed",
        at: input.movedAt,
        detail,
      });
      return { move: null, skipReason: "rename-failed" };
    }

    const destinationHash = await this.hashDestination(destination);
    if (destinationHash !== input.group.sha256) {
      const reason =
        destinationHash === null ? "destination-unreadable" : "destination-hash-mismatch";
      if (!(await this.restoreSource(source, destination, input, reason))) {
        throw new AppError(
          APP_ERROR_CODES.INTERNAL,
          "A quarantined file failed verification and could not be restored",
          { source: input.candidate.path, destination },
        );
      }
      await this.appendSkip({
        groupId: input.group.groupId,
        file: input.candidate,
        reason,
        at: input.movedAt,
      });
      return { move: null, skipReason: reason };
    }

    const move: DuplicateCleanupMove = {
      fileId: input.candidate.fileId,
      sourcePath: input.candidate.path,
      quarantinePath: destination,
      sha256: input.group.sha256,
      sizeBytes: input.candidate.sizeBytes,
      createdAtFs: input.candidate.createdAtFs,
      modifiedAtFs: input.candidate.modifiedAtFs,
      keeperFileId: input.group.keeper.fileId,
      keeperPath: input.group.keeper.path,
      movedAt: input.movedAt,
    };
    await this.append({
      type: "file-moved",
      at: input.movedAt,
      runId: this.runId,
      groupId: input.group.groupId,
      fileId: move.fileId,
      path: move.sourcePath,
      destination: move.quarantinePath,
    });
    return { move, skipReason: null };
  }

  async recordGroupSkip(
    group: DuplicateCleanupGroup,
    reason: string,
    at: string,
    detail?: string,
  ): Promise<void> {
    await this.append({
      type: "group-skipped",
      at,
      runId: this.runId,
      groupId: group.groupId,
      path: group.keeper.path,
      reason,
      ...(detail === undefined ? {} : { detail }),
    });
  }

  async finish(
    status: "complete" | "cancelled" | "failed",
    at: string,
    detail?: string,
  ): Promise<void> {
    await this.append({
      type: "run-finished",
      at,
      runId: this.runId,
      reason: status,
      ...(detail === undefined ? {} : { detail }),
    });
  }

  private async hashDestination(destination: string): Promise<string | null> {
    try {
      return await this.hasher.hash(destination);
    } catch {
      return null;
    }
  }

  private async restoreSource(
    source: string,
    destination: string,
    input: {
      group: DuplicateCleanupGroup;
      candidate: DuplicateCleanupFile;
      movedAt: string;
    },
    reason: string,
  ): Promise<boolean> {
    try {
      await rename(destination, source);
      await this.append({
        type: "file-restored",
        at: input.movedAt,
        runId: this.runId,
        groupId: input.group.groupId,
        fileId: input.candidate.fileId,
        path: input.candidate.path,
        destination,
        reason,
      });
      return true;
    } catch (error) {
      await this.append({
        type: "file-restore-failed",
        at: input.movedAt,
        runId: this.runId,
        groupId: input.group.groupId,
        fileId: input.candidate.fileId,
        path: input.candidate.path,
        destination,
        reason,
        detail: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  private async uniqueDestination(target: string): Promise<string> {
    let candidate = target;
    let index = 1;
    while (await pathExists(candidate)) {
      candidate = uniqueSuffix(target, index);
      index += 1;
    }
    return candidate;
  }

  private async appendSkip(input: {
    groupId: number;
    file: DuplicateCleanupFile;
    reason: string;
    at: string;
    detail?: string;
  }): Promise<void> {
    await this.append({
      type: "file-skipped",
      at: input.at,
      runId: this.runId,
      groupId: input.groupId,
      fileId: input.file.fileId,
      path: input.file.path,
      reason: input.reason,
      ...(input.detail === undefined ? {} : { detail: input.detail }),
    });
  }

  private async append(entry: JournalEntry): Promise<void> {
    if (this.journalPath === null) {
      throw new Error("Quarantine mover was not prepared");
    }
    await appendFile(this.journalPath, `${JSON.stringify(entry)}\n`, "utf8");
  }
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await lstat(target);
    return true;
  } catch {
    return false;
  }
}
