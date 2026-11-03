import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createDestinationWriter } from "./destination-writer";
import {
  markerDirectoryRelativePath,
  readAnyMarker,
  readMarker,
  writeMarker,
} from "./destination-marker";

const roots: string[] = [];

async function createRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "memory-lane-marker-"));
  roots.push(root);
  return root;
}

const marker = {
  schemaVersion: 1 as const,
  catalogId: "catalog-1",
  destinationId: "dest-1",
  sourceLabel: "4TB Archive",
  sourceVolumeId: "volume-1",
  rootRelative: "",
  copyRootRelative: "Memory Lane/4TB Archive",
  replicaGoal: "full_copy" as const,
  replicaLayout: "dedicated" as const,
  localCatalogId: "local-1",
  localCatalogRelative: ".memorylane/catalog.db",
  sourceIndexRelative: ".memorylane/replicas/catalog-1/index.db",
  updatedAt: "2026-11-01T12:00:00.000Z",
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("destination marker", () => {
  it("writes, reads, and discovers a marker", async () => {
    const root = await createRoot();
    const writer = createDestinationWriter(root);
    await writeMarker(writer, marker);

    expect(await readMarker(root, "catalog-1")).toEqual(marker);
    expect(await readAnyMarker(root)).toEqual(marker);
  });

  it("[ML-REPL-028] returns null for missing or corrupt markers", async () => {
    const root = await createRoot();
    expect(await readMarker(root, "missing")).toBeNull();

    const directory = path.join(root, markerDirectoryRelativePath());
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "bad.json"), "not json");
    expect(await readAnyMarker(root)).toBeNull();
  });
});
