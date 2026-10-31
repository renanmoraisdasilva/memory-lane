import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";

const LockInfoSchema = z.object({
  pid: z.number().int().positive(),
  startedAt: z.string().min(1),
});

type LockInfo = z.infer<typeof LockInfoSchema>;

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function readLock(lockPath: string): LockInfo | null {
  try {
    const parsed = LockInfoSchema.safeParse(JSON.parse(fs.readFileSync(lockPath, "utf8")));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function acquireCatalogLock(appDirectory: string): () => void {
  fs.mkdirSync(appDirectory, { recursive: true });
  const lockPath = path.join(appDirectory, "catalog.lock");
  let locked = false;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const descriptor = fs.openSync(lockPath, "wx");
      fs.writeFileSync(
        descriptor,
        JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }),
      );
      fs.closeSync(descriptor);
      locked = true;
      break;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") {
        throw error;
      }

      const existing = readLock(lockPath);
      if (existing !== null && isProcessAlive(existing.pid)) {
        throw new AppError(
          APP_ERROR_CODES.CATALOG_LOCKED,
          "This catalog is already open in another Memory Lane instance",
          { lockPath, pid: existing.pid },
        );
      }

      fs.rmSync(lockPath, { force: true });
    }
  }

  if (!locked) {
    throw new AppError(APP_ERROR_CODES.CATALOG_LOCKED, "Unable to acquire the catalog lock", {
      lockPath,
    });
  }

  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    const current = readLock(lockPath);
    if (current !== null && current.pid === process.pid) {
      fs.rmSync(lockPath, { force: true });
    }
  };
}
