import { access, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { toVolumeId } from "@shared/contracts/drives";
import { AppError } from "@shared/domain/errors";
import { CATALOG_SCHEMA_VERSION } from "./schema-version";
import { createCatalogRegistry, type CatalogRegistry } from "./catalog-registry";
import { createReplicationDbHandlers, type ReplicationDbHandler } from "./replication-db-handlers";
import type { ReplicationDestinationRecord } from "./repositories/replication-destination-repository";

const roots: string[] = [];
const registries: CatalogRegistry[] = [];

async function createHarness(): Promise<{
  handler: ReplicationDbHandler;
  registry: CatalogRegistry;
  sourceRoot: string;
  destinationRoot: string;
  sourcePath: string;
}> {
  const root = await mkdtemp(path.join(os.tmpdir(), "memory-lane-replication-db-"));
  roots.push(root);
  const sourceRoot = path.join(root, "source");
  const destinationRoot = path.join(root, "destination");
  const sourcePath = path.join(sourceRoot, ".memorylane", "catalog.db");
  const registry = createCatalogRegistry();
  registries.push(registry);
  const source = registry.openSource({
    filePath: sourcePath,
    identity: {
      volumeId: toVolumeId("source-volume"),
      serialNumber: "SOURCE-SERIAL",
      label: "Archive",
      fileSystem: "NTFS",
      rootPath: sourceRoot,
      letter: "E:",
    },
    schemaVersion: CATALOG_SCHEMA_VERSION,
    create: true,
  });
  const handler = createReplicationDbHandlers({
    getCatalog: () => source,
    getCatalogPath: () => sourcePath,
    getRegistry: () => registry,
  });
  return { handler, registry, sourceRoot, destinationRoot, sourcePath };
}

function registerParams(destinationRoot: string) {
  return {
    destinationId: "dest-1",
    volumeId: toVolumeId("destination-volume"),
    volumeSerial: "DEST-SERIAL",
    label: "Backup A",
    fileSystem: "NTFS",
    letter: "F:",
    mountRootPath: destinationRoot,
    rootRelative: "",
    destinationCatalogPath: path.join(destinationRoot, ".memorylane", "catalog.db"),
    archiveFolderName: "4TB Archive",
    goal: "extend_coverage",
    layout: "dedicated",
    allocationMode: "all_safe",
    allocationPercent: null,
    allocationBytes: null,
    reserveBytes: 1024,
    now: "2026-11-01T12:00:00.000Z",
  };
}

afterEach(async () => {
  for (const registry of registries.splice(0)) {
    registry.closeAll();
  }
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("replication database handlers", () => {
  it("registers, lists, reads, finds, and updates a destination", async () => {
    const harness = await createHarness();

    expect(harness.handler.handle("replication.listDestinations", {})).toEqual([]);
    const source = harness.handler.handle("replication.getSourceIdentity", {}) as {
      catalogId: string;
      role: string;
    };
    expect(source.role).toBe("source");

    const created = harness.handler.handle(
      "replication.registerDestination",
      registerParams(harness.destinationRoot),
    ) as ReplicationDestinationRecord;
    expect(created).toMatchObject({
      destinationId: "dest-1",
      goal: "extend_coverage",
      priority: 0,
    });

    const listed = harness.handler.handle("replication.listDestinations", {}) as unknown[];
    expect(listed).toHaveLength(1);
    expect(
      harness.handler.handle("replication.getDestination", { destinationId: created.id }),
    ).toMatchObject({ destinationId: "dest-1" });
    expect(
      harness.handler.handle("replication.findDestinationByDestinationId", {
        destinationId: "dest-1",
      }),
    ).toMatchObject({ id: created.id });
    expect(
      harness.handler.handle("replication.findDestinationByVolume", {
        volumeId: "destination-volume",
      }),
    ).toMatchObject({ id: created.id });
    expect(
      harness.handler.handle("replication.findDestinationByVolume", {
        volumeId: "missing-volume",
      }),
    ).toBeNull();

    const updated = harness.handler.handle("replication.updateDestination", {
      destinationId: created.id,
      goal: "full_copy",
      allocationMode: "percent",
      allocationPercent: 50,
      priority: 4,
      status: "active",
    }) as ReplicationDestinationRecord;
    expect(updated).toMatchObject({
      goal: "full_copy",
      allocationMode: "percent",
      allocationPercent: 50,
      priority: 4,
    });

    const fullyUpdated = harness.handler.handle("replication.updateDestination", {
      destinationId: created.id,
      goal: "extend_coverage",
      allocationMode: "fixed",
      allocationPercent: null,
      allocationBytes: 4096,
      reserveBytes: 2048,
      priority: 2,
      layout: "mirror_source",
      status: "active",
    }) as ReplicationDestinationRecord;
    expect(fullyUpdated).toMatchObject({
      goal: "extend_coverage",
      allocationMode: "fixed",
      allocationPercent: null,
      allocationBytes: 4096,
      reserveBytes: 2048,
      priority: 2,
      layout: "mirror_source",
    });

    const unchanged = harness.handler.handle("replication.updateDestination", {
      destinationId: created.id,
    }) as ReplicationDestinationRecord;
    expect(unchanged).toMatchObject({
      goal: "extend_coverage",
      allocationMode: "fixed",
      allocationBytes: 4096,
    });
  });

  it("reports missing destinations", async () => {
    const harness = await createHarness();
    expect(() =>
      harness.handler.handle("replication.getDestination", { destinationId: 999 }),
    ).toThrow(AppError);
  });

  it("writes the destination archive identity", async () => {
    const harness = await createHarness();
    harness.handler.handle(
      "replication.registerDestination",
      registerParams(harness.destinationRoot),
    );
    const destination = harness.registry.getDestination("dest-1");
    const identity = destination
      .prepare("SELECT role, source_catalog_id, source_label FROM archive_identity WHERE id = 1")
      .get() as { role: string; source_catalog_id: string; source_label: string };
    expect(identity.role).toBe("destination_library");
    expect(identity.source_label).toBe("Archive");
    expect(identity.source_catalog_id).toHaveLength(36);
  });

  it("rejects relative paths and unknown methods", async () => {
    const harness = await createHarness();
    expect(() =>
      harness.handler.handle("replication.registerDestination", {
        ...registerParams(harness.destinationRoot),
        destinationCatalogPath: "catalog.db",
      }),
    ).toThrow(AppError);
    expect(() =>
      harness.handler.handle("replication.registerDestination", {
        ...registerParams(harness.destinationRoot),
        mountRootPath: "relative",
      }),
    ).toThrow(AppError);
    expect(() => harness.handler.handle("replication.unknown" as never, {})).toThrow(AppError);
  });

  it("serves source, adoption, coverage, library, and source-index methods", async () => {
    const harness = await createHarness();
    const created = harness.handler.handle(
      "replication.registerDestination",
      registerParams(harness.destinationRoot),
    ) as ReplicationDestinationRecord;
    const source = harness.registry.getSource();
    const now = "2026-11-01T12:00:00.000Z";
    source
      .prepare(
        `INSERT INTO files (path, name, size, state, last_seen_at, modified_at_fs)
         VALUES (?, 'a.jpg', 10, 'present', ?, ?)`,
      )
      .run(path.join(harness.sourceRoot, "photos", "a.jpg"), now, now);
    source
      .prepare(
        `INSERT INTO file_dates (file_id, resolved_date, precision)
         VALUES (1, '2011-07-04T15:30:00.000Z', 'exact')`,
      )
      .run();

    const sourceFiles = harness.handler.handle("replication.listSourceFiles", {}) as Array<{
      sourceRelativePath: string;
    }>;
    expect(sourceFiles[0]?.sourceRelativePath).toBe(path.join("photos", "a.jpg"));
    expect(
      harness.handler.handle("replication.saveSourceHash", {
        fileId: 1,
        sha256: "a".repeat(64),
        size: 10,
        modifiedAtFs: now,
        now,
      }),
    ).toEqual({ saved: true });
    expect(
      harness.handler.handle("replication.getAdoption", { destinationId: "dest-1" }),
    ).toMatchObject({ status: "idle" });
    harness.handler.handle("replication.beginAdoption", {
      destinationId: created.id,
      now,
    });
    expect(harness.handler.handle("replication.listAdoptions", {})).toMatchObject([
      { destinationKey: "dest-1", status: "scanning" },
    ]);
    harness.handler.handle("replication.saveAdoptionBatch", {
      destinationId: created.id,
      replicas: [
        {
          fileId: 1,
          relativePath: "Memory Lane\\Archive\\photos\\a.jpg",
          relativePathKey: "memory lane\\archive\\photos\\a.jpg",
          sourceRelativePath: "photos\\a.jpg",
          sourceRelativePathKey: "photos\\a.jpg",
          sizeBytes: 10,
          sha256: "a".repeat(64),
          status: "verified",
          sourceSizeAtVerify: 10,
          sourceModifiedAtFsAtVerify: now,
          destinationSizeAtVerify: 10,
          destinationModifiedAtFsAtVerify: now,
          lastCheckedAt: now,
          lastError: null,
        },
      ],
      orphans: [],
      touchedReplicaFileIds: [],
      now,
    });
    expect(
      harness.handler.handle("replication.listAdoptionReplicas", { destinationId: created.id }),
    ).toHaveLength(1);
    expect(harness.handler.handle("replication.listVerifiedCoverage", {})).toMatchObject([
      { destinationRowId: created.id, verifiedFileIds: [1], verifiedBytes: 10 },
    ]);
    expect(
      harness.handler.handle("replication.getDestinationCoverageMap", {
        destinationId: created.id,
      }),
    ).toEqual([{ year: 2011, month: 7, count: 1 }]);
    expect(
      harness.handler.handle("replication.getDestinationReplicaHealth", {
        destinationId: created.id,
      }),
    ).toEqual({ conflictFiles: 0, staleFiles: 0, missingFiles: 0 });
    expect(harness.handler.handle("replication.getOverlapBytes", {})).toBe(0);
    expect(
      harness.handler.handle("replication.getDestinationOverlapBytes", {
        destinationId: created.id,
      }),
    ).toBe(0);

    expect(
      harness.handler.handle("replication.upsertDestinationLibrary", {
        destinationId: created.id,
        destinationRoot: harness.destinationRoot,
        runStartedAt: now,
        now,
        files: [
          {
            relativePath: "photos\\a.jpg",
            name: "a.jpg",
            sizeBytes: 10,
            modifiedAtFs: now,
            mediaClass: "image",
            sha256: "a".repeat(64),
            resolvedDate: "2011-07-04T15:30:00.000Z",
          },
        ],
      }),
    ).toMatchObject({ files: 1, bytes: 10 });
    expect(
      harness.handler.handle("replication.getDestinationLibraryStats", {
        destinationId: created.id,
        destinationRoot: harness.destinationRoot,
      }),
    ).toMatchObject({ files: 1, bytes: 10 });

    const index = (await harness.handler.handle("replication.writeSourceIndex", {
      destinationId: created.id,
      destinationRoot: harness.destinationRoot,
      now,
    })) as { relativePath: string };
    await expect(
      access(path.join(harness.destinationRoot, index.relativePath)),
    ).resolves.toBeUndefined();

    harness.handler.handle("replication.markUnseenReplicasMissing", {
      destinationId: created.id,
      seenFileIds: [],
      seenOrphanPathKeys: [],
      now,
    });
    expect(
      harness.handler.handle("replication.listAdoptionReplicas", { destinationId: created.id }),
    ).toMatchObject([{ status: "missing" }]);
    harness.handler.handle("replication.updateAdoptionStatus", {
      destinationId: created.id,
      status: "paused",
      now,
      errorMessage: null,
    });
    harness.handler.handle("replication.finishAdoption", {
      destinationId: created.id,
      status: "complete",
      now,
      errorMessage: null,
    });
    expect(
      harness.handler.handle("replication.getAdoption", { destinationId: "dest-1" }),
    ).toMatchObject({ status: "complete" });
    expect(harness.handler.handle("replication.markInterruptedAdoptions", { now })).toEqual({
      interrupted: 0,
    });

    await expect(
      harness.handler.handle("replication.writeSourceIndex", {
        destinationId: created.id,
        destinationRoot: "relative",
        now,
      }),
    ).rejects.toBeInstanceOf(AppError);
    expect(() =>
      harness.handler.handle("replication.getDestinationLibraryStats", {
        destinationId: created.id,
        destinationRoot: "relative",
      }),
    ).toThrow(AppError);
  });
});
