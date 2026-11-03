import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { toVolumeId } from "@shared/contracts/drives";
import { afterEach, describe, expect, it } from "vitest";
import type { DetectedDrive } from "../../src/main/modules/drives/domain/drive";
import { DestinationService } from "../../src/main/modules/replication/application/destination-service";
import { handleMediaRequest } from "../../src/main/modules/media/media-request-handler";
import { createScanHarness, testLogger } from "./scan-harness";

const destinationRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    destinationRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("destination-scoped media", () => {
  it("[ML-REPL-090] serves media and thumbnails from the destination catalog only", async () => {
    const harness = await createScanHarness();
    const destinationRoot = await mkdtemp(path.join(os.tmpdir(), "memory-lane-media-dest-"));
    destinationRoots.push(destinationRoot);
    await mkdir(path.join(destinationRoot, "photos"), { recursive: true });
    await writeFile(path.join(destinationRoot, "photos", "a.jpg"), "JPEG");

    const destinationDrive: DetectedDrive = {
      ...harness.drive,
      volumeId: toVolumeId("media-destination-volume"),
      serialNumber: "MEDIA-SERIAL",
      label: "Backup A",
      letter: "F:",
      rootPath: destinationRoot,
      driveType: "removable",
      isExternal: true,
    };
    const listDetected = async (): Promise<DetectedDrive[]> => [harness.drive, destinationDrive];
    const logger = testLogger();
    const destinationService = new DestinationService({ db: harness.db, listDetected, logger });
    const destination = await destinationService.register({
      volumeId: destinationDrive.volumeId,
      rootRelative: "",
      goal: "extend_coverage",
      layout: "dedicated",
      allocationMode: "all_safe",
      allocationPercent: null,
      allocationBytes: null,
      reserveBytes: 1024,
    });
    const now = new Date().toISOString();
    await harness.db.request("replication.upsertDestinationLibrary", {
      destinationId: destination.id,
      destinationRoot,
      runStartedAt: now,
      now,
      files: [
        {
          relativePath: "photos\\a.jpg",
          name: "a.jpg",
          sizeBytes: 4,
          modifiedAtFs: now,
          mediaClass: "image",
          sha256: "a".repeat(64),
          resolvedDate: "2011-01-01T00:00:00.000Z",
        },
      ],
    });
    const destinationDb = new Database(path.join(destinationRoot, ".memorylane", "catalog.db"), {
      readonly: true,
    });
    const fileId = destinationDb
      .prepare("SELECT id FROM files WHERE name = 'a.jpg'")
      .pluck()
      .get() as number;
    destinationDb.close();

    const thumbnails = {
      generate: async (_source: string, output: string) => {
        await writeFile(output, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
        return { bytes: 4 };
      },
    };
    const previews = {
      convert: async (_source: string, output: string) => {
        await writeFile(output, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
        return { bytes: 4 };
      },
      shutdown: async () => undefined,
    };

    try {
      const media = await handleMediaRequest(
        { db: harness.db, listDetected, thumbnails, previews, logger },
        new Request(`ml-media://destination/${destination.destinationId}/media/${fileId}`),
      );
      expect(media.status).toBe(200);
      expect(await media.text()).toBe("JPEG");

      const thumbnail = await handleMediaRequest(
        { db: harness.db, listDetected, thumbnails, previews, logger },
        new Request(`ml-media://destination/${destination.destinationId}/thumbnail/${fileId}`),
      );
      expect(thumbnail.status).toBe(200);
      expect((await thumbnail.arrayBuffer()).byteLength).toBe(4);

      const unknown = await handleMediaRequest(
        { db: harness.db, listDetected, thumbnails, previews, logger },
        new Request("ml-media://destination/missing/media/1"),
      );
      expect(unknown.status).toBe(404);
    } finally {
      await harness.dispose();
    }
  });
});
