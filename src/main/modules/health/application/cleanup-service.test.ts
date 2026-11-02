import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { toVolumeId } from "@shared/contracts/drives";
import { AppError } from "@shared/domain/errors";
import type { DbClient } from "../../../clients/db-client";
import { createCleanupDbHandlers } from "../../../db/cleanup-db-handlers";
import { catalogMigrations } from "../../../db/migrations/catalog-migrations";
import { runMigrations } from "../../../db/migrations/runner";
import { ensureDriveIdentity } from "../../../db/repositories/catalog-repository";
import type { DbMethod } from "../../../db/worker-protocol";
import type { Logger } from "../../../logging/types";
import { createFileHasher } from "../../scanning/infrastructure/file-hasher";
import { WorkloadCoordinator } from "../../workloads/application/workload-coordinator";
import { CleanupService } from "./cleanup-service";
import { QuarantineMover } from "../infrastructure/quarantine-mover";

const volumeId = toVolumeId("volume-1");
const now = "2026-11-02T12:00:00.000Z";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

function logger(): Logger {
  return {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    debug: () => undefined,
  };
}

function sha(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

interface Harness {
  root: string;
  db: Database.Database;
  client: DbClient;
  service: CleanupService;
  workloads: WorkloadCoordinator;
  candidatePath: string;
  keeperPath: string;
  quarantineRoot: string;
}

async function createHarness(
  options: {
    createMover?: (hasher: ReturnType<typeof createFileHasher>) => QuarantineMover;
  } = {},
): Promise<Harness> {
  const root = await mkdtemp(path.join(os.tmpdir(), "memory-lane-cleanup-service-"));
  temporaryDirectories.push(root);
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db, catalogMigrations);
  ensureDriveIdentity(
    db,
    {
      volumeId,
      serialNumber: "SERIAL",
      label: "Archive",
      fileSystem: "NTFS",
      rootPath: root,
      letter: "X:",
    },
    12,
  );

  const content = Buffer.alloc(2048, 5);
  const keeperPath = path.join(root, "keep", "photo.jpg");
  const candidatePath = path.join(root, "phone", "photo.jpg");
  await Promise.all([
    mkdir(path.dirname(keeperPath), { recursive: true }),
    mkdir(path.dirname(candidatePath), { recursive: true }),
  ]);
  await writeFile(keeperPath, content);
  await writeFile(candidatePath, content);
  const hash = sha(content);
  const modified = "2020-01-01T00:00:00.000Z";
  const insert = db.prepare(
    `INSERT INTO files (
      path, name, size, created_at_fs, modified_at_fs, media_class, state, last_seen_at
    ) VALUES (?, 'photo.jpg', ?, ?, ?, 'image', 'present', ?) RETURNING id`,
  );
  const keeper = insert.get(keeperPath, content.length, modified, modified, now) as { id: number };
  const candidate = insert.get(candidatePath, content.length, modified, modified, now) as {
    id: number;
  };
  db.prepare(
    "INSERT INTO hashes (file_id, sha256, hashed_at, status) VALUES (?, ?, ?, 'complete')",
  ).run(keeper.id, hash, now);
  db.prepare(
    "INSERT INTO hashes (file_id, sha256, hashed_at, status) VALUES (?, ?, ?, 'complete')",
  ).run(candidate.id, hash, now);

  const destination = db
    .prepare(
      `INSERT INTO replica_destinations (
        destination_id, volume_id, label, replica_goal, reserve_bytes, priority, created_at, updated_at
      ) VALUES ('dest-1', 'volume-2', 'Backup A', 'extend_coverage', 1024, 1, ?, ?)
      RETURNING id`,
    )
    .get(now, now) as { id: number };
  db.prepare("INSERT INTO replication_adoptions (destination_id) VALUES (?)").run(destination.id);
  db.prepare(
    `INSERT INTO replica_files (
      replica_id, file_id, relative_path, relative_path_key, source_relative_path,
      source_relative_path_key, size_bytes, sha256, status, verified_at,
      source_size_at_verify, source_modified_at_fs_at_verify
    ) VALUES (?, ?, 'keep\\photo.jpg', 'keep\\photo.jpg', 'keep\\photo.jpg', 'keep\\photo.jpg',
      ?, ?, 'verified', ?, ?, ?)`,
  ).run(destination.id, keeper.id, content.length, hash, now, content.length, modified);

  const handler = createCleanupDbHandlers({
    getCatalog: () => db,
    getCatalogPath: () => path.join(root, ".memorylane", "catalog.db"),
  });
  const client: DbClient = {
    request: async <T>(method: DbMethod, params: unknown): Promise<T> =>
      handler.handle(method as Parameters<typeof handler.handle>[0], params) as T,
  };
  const workloads = new WorkloadCoordinator();
  const service = new CleanupService({
    db: client,
    hasher: createFileHasher(),
    logger: logger(),
    workloads,
    ...(options.createMover === undefined ? {} : { createMover: options.createMover }),
  });
  return {
    root,
    db,
    client,
    service,
    workloads,
    candidatePath,
    keeperPath,
    quarantineRoot: path.join(root, ".memorylane_quarantine"),
  };
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

async function waitForTerminal(service: CleanupService): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 10_000) {
    const state = await service.getState();
    if (state.status === "complete" || state.status === "cancelled" || state.status === "failed") {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Cleanup did not finish");
}

describe("cleanup service", () => {
  it("moves the candidate, keeps the keeper, and records the run", async () => {
    const harness = await createHarness();
    const state = await harness.service.start();
    expect(state.status).toBe("running");
    await waitForTerminal(harness.service);

    const finished = await harness.service.getState();
    expect(finished).toMatchObject({
      status: "complete",
      groupsProcessed: 1,
      filesMoved: 1,
      filesSkipped: 0,
      bytesMoved: 2048,
    });
    expect(finished.quarantinePath).not.toBeNull();
    await expect(stat(harness.keeperPath)).resolves.toBeDefined();
    await expect(stat(harness.candidatePath)).rejects.toBeDefined();
    expect(
      (await stat(path.join(finished.quarantinePath as string, "phone", "photo.jpg"))).size,
    ).toBe(2048);
    expect(
      await readFile(path.join(finished.quarantinePath as string, "journal.jsonl"), "utf8"),
    ).toContain('"type":"file-moved"');
    expect(harness.db.prepare("SELECT COUNT(*) AS count FROM files").get()).toEqual({ count: 1 });
    expect(harness.db.prepare("SELECT COUNT(*) AS count FROM cleanup_moves").get()).toEqual({
      count: 1,
    });
    expect(harness.workloads.isActive()).toBe(false);
    harness.db.close();
  });

  it("allows a run when no copy has verified coverage and reports the warning count", async () => {
    const harness = await createHarness();
    harness.db.prepare("DELETE FROM replica_files").run();
    const state = await harness.service.start();
    expect(state.groupsWithoutCoverage).toBe(1);
    await waitForTerminal(harness.service);

    const finished = await harness.service.getState();
    expect(finished).toMatchObject({
      status: "complete",
      groupsWithoutCoverage: 1,
      filesMoved: 1,
    });
    harness.db.close();
  });

  it("rejects a start while another workload is active", async () => {
    const harness = await createHarness();
    const lease = harness.workloads.acquire("scan", "scan");
    await expect(harness.service.start()).rejects.toBeInstanceOf(AppError);
    lease.release();
    harness.db.close();
  });

  it("cancels after the current file", async () => {
    const gate = deferred();
    const started = deferred();
    class GatedMover extends QuarantineMover {
      override async move(
        input: Parameters<QuarantineMover["move"]>[0],
      ): ReturnType<QuarantineMover["move"]> {
        started.resolve();
        await gate.promise;
        return super.move(input);
      }
    }
    const harness = await createHarness({ createMover: (hasher) => new GatedMover(hasher) });
    await harness.service.start();
    await started.promise;
    expect(() => harness.service.assertCanChangeCatalog()).toThrow(AppError);
    await harness.service.cancel();
    gate.resolve();
    await waitForTerminal(harness.service);

    const finished = await harness.service.getState();
    expect(finished).toMatchObject({ status: "cancelled", filesMoved: 1 });
    await expect(stat(harness.candidatePath)).rejects.toBeDefined();
    harness.db.close();
  });
});
