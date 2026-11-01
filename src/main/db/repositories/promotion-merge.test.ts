import path from "node:path";
import { describe, expect, it } from "vitest";
import { toVolumeId } from "@shared/contracts/drives";
import { CATALOG_SCHEMA_VERSION } from "../schema-version";
import { mergePromotion } from "./promotion-merge";
import {
  destinationCatalogPath,
  now,
  seedDestination,
  seedSource,
  sourceCatalogPath,
} from "./promotion-merge-fixtures";

describe("promotion merge", () => {
  it("merges a mirror-layout full copy, retires fates, and preserves rows", () => {
    const source = seedSource();
    const destination = seedDestination();
    const result = mergePromotion({
      source,
      destination,
      sourceCatalogPath,
      destinationCatalogPath,
      destinationId: "dest-full",
      oldSourceFate: "retire",
      partialFates: [{ destinationId: "dest-partial", keep: false }],
      oldSourceFits: false,
      sourceSnapshotPath: "C:\\old\\.memorylane\\snapshots\\source.db",
      destinationSnapshotPath: "C:\\new\\.memorylane\\snapshots\\destination.db",
      now,
      schemaVersion: CATALOG_SCHEMA_VERSION,
    });
    expect(result.newSourceRootRelative).toBe("");
    expect(result.catalog.volumeId).toBe(toVolumeId("volume-new"));

    const identity = destination
      .prepare(
        "SELECT catalog_id, role, source_root_relative, previous_local_catalog_id FROM archive_identity",
      )
      .get();
    expect(identity).toEqual({
      catalog_id: "catalog-1",
      role: "source",
      source_root_relative: "",
      previous_local_catalog_id: "local-1",
    });
    const files = destination
      .prepare("SELECT name, path, relative_path, source_membership FROM files ORDER BY name")
      .all() as Array<Record<string, unknown>>;
    expect(files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "a.jpg",
          path: "C:\\new\\photos\\a.jpg",
          relative_path: "photos\\a.jpg",
          source_membership: "source",
        }),
        expect.objectContaining({
          name: "Outside.txt",
          source_membership: "local_only",
        }),
      ]),
    );
    expect(
      destination
        .prepare(
          "SELECT is_override FROM file_dates WHERE file_id = (SELECT id FROM files WHERE name = 'a.jpg')",
        )
        .get(),
    ).toEqual({ is_override: 1 });
    expect(destination.prepare("SELECT COUNT(*) AS count FROM date_overrides").get()).toEqual({
      count: 1,
    });
    expect(destination.prepare("SELECT COUNT(*) AS count FROM duplicate_members").get()).toEqual({
      count: 2,
    });
    expect(destination.prepare("SELECT COUNT(*) AS count FROM missing_files").get()).toEqual({
      count: 1,
    });
    expect(destination.prepare("SELECT COUNT(*) AS count FROM file_metadata").get()).toEqual({
      count: 1,
    });

    const destinations = destination
      .prepare(
        "SELECT label, replica_goal, status, full_copy_status FROM replica_destinations ORDER BY id",
      )
      .all() as Array<Record<string, unknown>>;
    expect(destinations).toEqual([
      expect.objectContaining({
        label: "Backup B",
        status: "retired",
        full_copy_status: "not_applicable",
      }),
      expect.objectContaining({
        label: "Old Source",
        status: "retired",
        full_copy_status: "not_applicable",
      }),
    ]);
    expect(destination.prepare("SELECT COUNT(*) AS count FROM replica_orphans").get()).toEqual({
      count: 1,
    });
    const oldSourceReplicas = destination
      .prepare(
        `SELECT COUNT(*) AS count FROM replica_files rf
         JOIN replica_destinations d ON d.id = rf.replica_id WHERE d.label = 'Old Source'`,
      )
      .get() as { count: number };
    expect(oldSourceReplicas.count).toBeGreaterThan(0);
    source.close();
    destination.close();
  });

  it("uses the dedicated copy root and keeps active fates", () => {
    const source = seedSource();
    const destination = seedDestination();
    source
      .prepare(
        `UPDATE replica_destinations
         SET replica_layout = 'dedicated', copy_root_relative = 'Memory Lane/Archive'
         WHERE destination_id = 'dest-full'`,
      )
      .run();
    source
      .prepare(
        "UPDATE replica_destinations SET status = 'lost' WHERE destination_id = 'dest-partial'",
      )
      .run();
    const result = mergePromotion({
      source,
      destination,
      sourceCatalogPath,
      destinationCatalogPath,
      destinationId: "dest-full",
      oldSourceFate: "extend_coverage",
      partialFates: [{ destinationId: "dest-partial", keep: true }],
      oldSourceFits: true,
      sourceSnapshotPath: "C:\\old\\snapshot.db",
      destinationSnapshotPath: "C:\\new\\snapshot.db",
      now,
      schemaVersion: CATALOG_SCHEMA_VERSION,
    });
    expect(result.newSourceRootRelative).toBe(path.join("Memory Lane", "Archive"));
    const destinations = destination
      .prepare("SELECT label, replica_goal, status FROM replica_destinations ORDER BY id")
      .all() as Array<Record<string, unknown>>;
    expect(destinations).toEqual([
      expect.objectContaining({
        label: "Backup B",
        status: "lost",
        replica_goal: "extend_coverage",
      }),
      expect.objectContaining({
        label: "Old Source",
        status: "active",
        replica_goal: "extend_coverage",
      }),
    ]);
    const a = destination
      .prepare(
        "SELECT path, source_membership FROM files WHERE name = 'a.jpg' AND source_membership = 'source'",
      )
      .get();
    expect(a).toEqual({
      path: path.join("C:\\new", "Memory Lane", "Archive", "photos", "a.jpg"),
      source_membership: "source",
    });
    source.close();
    destination.close();
  });

  it("supports a non-empty old source root and default active partial fates", () => {
    const source = seedSource();
    const destination = seedDestination();
    source
      .prepare("UPDATE files SET path = REPLACE(path, 'C:\\old\\', 'C:\\old\\Archive\\')")
      .run();
    source
      .prepare(
        "UPDATE missing_files SET last_path = REPLACE(last_path, 'C:\\old\\', 'C:\\old\\Archive\\')",
      )
      .run();
    source
      .prepare("UPDATE archive_identity SET source_root_relative = 'Archive' WHERE id = 1")
      .run();
    const result = mergePromotion({
      source,
      destination,
      sourceCatalogPath,
      destinationCatalogPath,
      destinationId: "dest-full",
      oldSourceFate: "extend_coverage",
      partialFates: [],
      oldSourceFits: true,
      sourceSnapshotPath: "C:\\old\\snapshot.db",
      destinationSnapshotPath: "C:\\new\\snapshot.db",
      now,
      schemaVersion: CATALOG_SCHEMA_VERSION,
    });
    expect(result.newSourceRootRelative).toBe("");
    const partial = destination
      .prepare("SELECT status FROM replica_destinations WHERE label = 'Backup B'")
      .get();
    expect(partial).toEqual({ status: "active" });
    const oldSource = destination
      .prepare("SELECT root_relative, status FROM replica_destinations WHERE label = 'Old Source'")
      .get();
    expect(oldSource).toEqual({ root_relative: "Archive", status: "active" });
    const d = destination.prepare("SELECT path FROM files WHERE name = 'd.jpg'").get();
    expect(d).toEqual({ path: "C:\\new\\photos\\d.jpg" });
    source.close();
    destination.close();
  });

  it("rejects missing, non-full, and inactive destinations", () => {
    const source = seedSource();
    const destination = seedDestination();
    const input = {
      source,
      destination,
      sourceCatalogPath,
      destinationCatalogPath,
      oldSourceFate: "full_copy" as const,
      partialFates: [],
      oldSourceFits: true,
      sourceSnapshotPath: "C:\\old\\snapshot.db",
      destinationSnapshotPath: "C:\\new\\snapshot.db",
      now,
      schemaVersion: CATALOG_SCHEMA_VERSION,
    };
    expect(() => mergePromotion({ ...input, destinationId: "missing" })).toThrow(/not found/);
    expect(() => mergePromotion({ ...input, destinationId: "dest-partial" })).toThrow(
      /active full-copy/,
    );
    source
      .prepare(
        "UPDATE replica_destinations SET status = 'retired' WHERE destination_id = 'dest-full'",
      )
      .run();
    expect(() => mergePromotion({ ...input, destinationId: "dest-full" })).toThrow(
      /active full-copy/,
    );
    source
      .prepare(
        `UPDATE replica_destinations
         SET status = 'active', replica_layout = 'dedicated', copy_root_relative = '..\\Outside'
         WHERE destination_id = 'dest-full'`,
      )
      .run();
    expect(() => mergePromotion({ ...input, destinationId: "dest-full" })).toThrow(
      /new source root/,
    );
    source
      .prepare(
        `UPDATE replica_destinations
         SET copy_root_relative = NULL WHERE destination_id = 'dest-full'`,
      )
      .run();
    expect(mergePromotion({ ...input, destinationId: "dest-full" }).newSourceRootRelative).toBe("");
    source.close();
    destination.close();
  });
});
