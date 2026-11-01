import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import { toVolumeId } from "@shared/contracts/drives";
import { CATALOG_SCHEMA_VERSION } from "./schema-version";
import { openDatabase } from "./connection";
import type { ReplicationDbHandlerOptions } from "./replication-db-handler-options";

const ROLLBACK_MARKER = path.join(".memorylane", "promotion-rollback.json");

export const RollbackMarkerSchema = z.object({
  schemaVersion: z.literal(1),
  promotionId: z.number().int().positive(),
  catalogId: z.string().min(1),
  openedAt: z.string().min(1),
  available: z.boolean(),
});
export type RollbackMarker = z.infer<typeof RollbackMarkerSchema>;

export function catalogRoot(catalogPath: string): string {
  return path.dirname(path.dirname(catalogPath));
}

export function readRollbackMarker(root: string): RollbackMarker | null {
  try {
    const parsed = RollbackMarkerSchema.safeParse(
      JSON.parse(fs.readFileSync(path.join(root, ROLLBACK_MARKER), "utf8")),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function writeRollbackMarker(root: string, marker: RollbackMarker): void {
  const target = path.join(root, ROLLBACK_MARKER);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(marker, null, 2)}\n`, "utf8");
}

export function removeRollbackMarker(root: string): void {
  fs.rmSync(path.join(root, ROLLBACK_MARKER), { force: true });
}

export function replaceCatalog(snapshotPath: string, catalogPath: string): void {
  fs.copyFileSync(snapshotPath, catalogPath);
  fs.rmSync(`${catalogPath}-wal`, { force: true });
  fs.rmSync(`${catalogPath}-shm`, { force: true });
}

function letterForRoot(_root: string): string | null {
  return null;
}

export function readIdentityFromCatalog(catalogPath: string): {
  volumeId: ReturnType<typeof toVolumeId>;
  serialNumber: string | null;
  label: string;
  fileSystem: string;
  rootPath: string;
  letter: string | null;
} {
  const db = openDatabase(catalogPath);
  try {
    const row = db
      .prepare(
        "SELECT volume_id, volume_serial, label, file_system FROM drive_identity WHERE id = 1",
      )
      .get() as
      | { volume_id: string; volume_serial: string | null; label: string; file_system: string }
      | undefined;
    if (row === undefined) {
      throw new AppError(
        APP_ERROR_CODES.PROMOTION_FAILED,
        "Restored catalog has no drive identity",
      );
    }
    const rootPath = catalogRoot(catalogPath);
    return {
      volumeId: toVolumeId(row.volume_id),
      serialNumber: row.volume_serial,
      label: row.label,
      fileSystem: row.file_system,
      rootPath,
      letter: letterForRoot(rootPath),
    };
  } finally {
    db.close();
  }
}

export function restoreCatalogs(
  options: ReplicationDbHandlerOptions,
  input: {
    sourcePath: string;
    destinationPath: string;
    sourceSnapshot: string;
    destinationSnapshot: string;
  },
): void {
  options.getRegistry().closeAll();
  replaceCatalog(input.sourceSnapshot, input.sourcePath);
  replaceCatalog(input.destinationSnapshot, input.destinationPath);
  const identity = readIdentityFromCatalog(input.sourcePath);
  options.getRegistry().openSource({
    filePath: input.sourcePath,
    identity,
    schemaVersion: CATALOG_SCHEMA_VERSION,
    create: false,
  });
}

export function snapshotPaths(
  sourceCatalogPath: string,
  destinationCatalogPath: string,
): { source: string; destination: string; sourceDirectory: string; destinationDirectory: string } {
  const id = randomUUID();
  const sourceDirectory = path.join(
    catalogRoot(sourceCatalogPath),
    ".memorylane",
    "promotion-snapshots",
  );
  const destinationDirectory = path.join(
    catalogRoot(destinationCatalogPath),
    ".memorylane",
    "promotion-snapshots",
  );
  fs.mkdirSync(sourceDirectory, { recursive: true });
  fs.mkdirSync(destinationDirectory, { recursive: true });
  return {
    source: path.join(sourceDirectory, `source-${id}.db`),
    destination: path.join(destinationDirectory, `destination-${id}.db`),
    sourceDirectory,
    destinationDirectory,
  };
}
