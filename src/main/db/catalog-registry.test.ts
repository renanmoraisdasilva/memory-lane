import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { toVolumeId } from "@shared/contracts/drives";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import { createCatalogRegistry } from "./catalog-registry";
import { CATALOG_SCHEMA_VERSION } from "./schema-version";

const roots: string[] = [];
const registries: Array<ReturnType<typeof createCatalogRegistry>> = [];

async function createRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "memory-lane-registry-"));
  roots.push(root);
  return root;
}

function identity(rootPath: string, volumeId: string) {
  return {
    volumeId: toVolumeId(volumeId),
    serialNumber: `SERIAL-${volumeId}`,
    label: `Drive ${volumeId}`,
    fileSystem: "NTFS",
    rootPath,
    letter: null,
  };
}

afterEach(async () => {
  for (const registry of registries.splice(0)) {
    registry.closeAll();
  }
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("catalog registry", () => {
  it("opens a source and destination catalog at the same time", async () => {
    const root = await createRoot();
    const sourceRoot = path.join(root, "source");
    const destinationRoot = path.join(root, "destination");
    const registry = createCatalogRegistry();
    registries.push(registry);

    const sourcePath = path.join(sourceRoot, ".memorylane", "catalog.db");
    const destinationPath = path.join(destinationRoot, ".memorylane", "catalog.db");
    const source = registry.openSource({
      filePath: sourcePath,
      identity: identity(sourceRoot, "source-volume"),
      schemaVersion: CATALOG_SCHEMA_VERSION,
      create: true,
    });
    const destination = registry.openDestination({
      destinationId: "dest-1",
      filePath: destinationPath,
      identity: identity(destinationRoot, "destination-volume"),
      schemaVersion: CATALOG_SCHEMA_VERSION,
      createIfMissing: true,
    });

    expect(registry.getSource()).toBe(source);
    expect(registry.getDestination("dest-1")).toBe(destination);
    expect(registry.getSourcePath()).toBe(sourcePath);
    expect(registry.getDestinationPath("dest-1")).toBe(destinationPath);
    expect(
      (
        source.prepare("SELECT MAX(version) AS version FROM schema_migrations").get() as {
          version: number;
        }
      ).version,
    ).toBe(CATALOG_SCHEMA_VERSION);
    expect(
      (
        destination.prepare("SELECT MAX(version) AS version FROM schema_migrations").get() as {
          version: number;
        }
      ).version,
    ).toBe(CATALOG_SCHEMA_VERSION);
  });

  it("rejects the source as a destination and duplicate destination paths", async () => {
    const root = await createRoot();
    const sourceRoot = path.join(root, "source");
    const destinationRoot = path.join(root, "destination");
    const registry = createCatalogRegistry();
    registries.push(registry);

    const sourcePath = path.join(sourceRoot, ".memorylane", "catalog.db");
    const destinationPath = path.join(destinationRoot, ".memorylane", "catalog.db");
    registry.openSource({
      filePath: sourcePath,
      identity: identity(sourceRoot, "source-volume"),
      schemaVersion: CATALOG_SCHEMA_VERSION,
      create: true,
    });
    registry.openDestination({
      destinationId: "dest-1",
      filePath: destinationPath,
      identity: identity(destinationRoot, "destination-volume"),
      schemaVersion: CATALOG_SCHEMA_VERSION,
      createIfMissing: true,
    });

    expect(() =>
      registry.openDestination({
        destinationId: "dest-2",
        filePath: sourcePath,
        identity: identity(sourceRoot, "other-volume"),
        schemaVersion: CATALOG_SCHEMA_VERSION,
        createIfMissing: true,
      }),
    ).toThrow(AppError);

    try {
      registry.openDestination({
        destinationId: "dest-2",
        filePath: destinationPath,
        identity: identity(destinationRoot, "other-volume"),
        schemaVersion: CATALOG_SCHEMA_VERSION,
        createIfMissing: true,
      });
    } catch (error) {
      expect((error as AppError).code).toBe(APP_ERROR_CODES.INVALID_REQUEST);
    }
  });

  it("reuses the same destination session and closes it on request", async () => {
    const root = await createRoot();
    const destinationRoot = path.join(root, "destination");
    const registry = createCatalogRegistry();
    registries.push(registry);
    const destinationPath = path.join(destinationRoot, ".memorylane", "catalog.db");
    const input = {
      destinationId: "dest-1",
      filePath: destinationPath,
      identity: identity(destinationRoot, "destination-volume"),
      schemaVersion: CATALOG_SCHEMA_VERSION,
      createIfMissing: true,
    };

    const first = registry.openDestination(input);
    const second = registry.openDestination(input);
    expect(second).toBe(first);

    registry.closeDestination("dest-1");
    expect(() => registry.getDestination("dest-1")).toThrow(AppError);
    expect(() => registry.openDestination({ ...input, createIfMissing: true })).not.toThrow();
  });

  it("reports missing sessions and rejects missing catalogs", async () => {
    const root = await createRoot();
    const registry = createCatalogRegistry();
    registries.push(registry);
    const sourceRoot = path.join(root, "source");
    const destinationRoot = path.join(root, "destination");
    const sourcePath = path.join(sourceRoot, ".memorylane", "catalog.db");
    const destinationPath = path.join(destinationRoot, ".memorylane", "catalog.db");

    expect(() => registry.getSource()).toThrow(AppError);
    expect(() => registry.getSourcePath()).toThrow(AppError);
    expect(() => registry.getDestination("missing")).toThrow(AppError);
    expect(() => registry.getDestinationPath("missing")).toThrow(AppError);
    registry.closeDestination("missing");

    expect(() =>
      registry.openDestination({
        destinationId: "dest-1",
        filePath: destinationPath,
        identity: identity(destinationRoot, "destination-volume"),
        schemaVersion: CATALOG_SCHEMA_VERSION,
        createIfMissing: false,
      }),
    ).toThrow(AppError);

    registry.openSource({
      filePath: sourcePath,
      identity: identity(sourceRoot, "source-volume"),
      schemaVersion: CATALOG_SCHEMA_VERSION,
      create: true,
    });
    registry.openDestination({
      destinationId: "dest-1",
      filePath: destinationPath,
      identity: identity(destinationRoot, "destination-volume"),
      schemaVersion: CATALOG_SCHEMA_VERSION,
      createIfMissing: true,
    });

    expect(() =>
      registry.openSource({
        filePath: destinationPath,
        identity: identity(destinationRoot, "destination-volume"),
        schemaVersion: CATALOG_SCHEMA_VERSION,
        create: false,
      }),
    ).toThrow(AppError);

    registry.closeAll();
    expect(() => registry.getSource()).toThrow(AppError);
    expect(() => registry.getDestination("dest-1")).toThrow(AppError);
  });
});
