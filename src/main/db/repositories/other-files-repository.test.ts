import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { toVolumeId } from "@shared/contracts/drives";
import { catalogMigrations } from "../migrations/catalog-migrations";
import { runMigrations } from "../migrations/runner";
import { ensureDriveIdentity } from "./catalog-repository";
import { getOtherFiles } from "./other-files-repository";

const volumeId = toVolumeId("volume-1");
const now = "2026-10-31T12:00:00.000Z";

function createDb(): Database.Database {
  const db = new Database(":memory:");
  runMigrations(db, catalogMigrations);
  ensureDriveIdentity(
    db,
    {
      volumeId,
      serialNumber: "SERIAL",
      label: "Archive",
      fileSystem: "NTFS",
      rootPath: "C:\\",
      letter: "C:",
    },
    5,
  );
  return db;
}

function insertFile(
  db: Database.Database,
  name: string,
  extension: string | null,
  options: { mediaClass?: "image" | "video" | "other"; modifiedAt?: string | null } = {},
): void {
  db.prepare(
    `INSERT INTO files (
      path, name, extension, size, modified_at_fs, media_class, format, mime, state, last_seen_at
    ) VALUES (?, ?, ?, 100, ?, ?, ?, ?, 'present', ?)`,
  ).run(
    `C:\\archive\\${name}`,
    name,
    extension,
    options.modifiedAt === undefined ? now : options.modifiedAt,
    options.mediaClass ?? "other",
    extension?.toUpperCase() ?? null,
    `application/${extension ?? "octet-stream"}`,
    now,
  );
}

describe("other files repository", () => {
  it("[ML-REL-009] categorizes non-media files and reports category counts", () => {
    const db = createDb();
    insertFile(db, "letter.docx", "docx");
    insertFile(db, "budget.XLSX", "XLSX");
    insertFile(db, "slides.pptx", "pptx");
    insertFile(db, "manual.pdf", "pdf");
    insertFile(db, "song.flac", "flac");
    insertFile(db, "backup.zip", "zip");
    insertFile(db, "notes.txt", "txt");
    insertFile(db, "no-extension", null);
    insertFile(db, "photo.jpg", "jpg", { mediaClass: "image" });
    insertFile(db, "clip.mp4", "mp4", { mediaClass: "video" });

    const page = getOtherFiles(db, "all", 0, 50);
    expect(page.total).toBe(8);
    expect(page.counts).toEqual({
      all: 8,
      documents: 2,
      spreadsheets: 1,
      presentations: 1,
      pdfs: 1,
      audio: 1,
      archives: 1,
      other: 1,
    });
    expect(page.items.map((item) => item.name)).not.toContain("photo.jpg");
    expect(page.items.find((item) => item.name === "no-extension")).toMatchObject({
      category: "other",
      modifiedAtFs: now,
    });
    db.close();
  });

  it("[ML-REL-009] filters by category, paginates, and accepts missing modified dates", () => {
    const db = createDb();
    insertFile(db, "a.pdf", "pdf");
    insertFile(db, "b.pdf", "pdf", { modifiedAt: null });
    insertFile(db, "c.pdf", "pdf");
    insertFile(db, "d.docx", "docx");

    const first = getOtherFiles(db, "pdfs", 0, 2);
    expect(first.total).toBe(3);
    expect(first.items).toHaveLength(2);
    expect(first.items[0]).toMatchObject({ name: "a.pdf", folder: "C:\\archive" });

    const second = getOtherFiles(db, "pdfs", 1, 1);
    expect(second.items).toHaveLength(1);
    expect(second.items[0]?.modifiedAtFs).toBeNull();

    expect(getOtherFiles(db, "documents", 0, 50).total).toBe(1);
    expect(getOtherFiles(db, "audio", 0, 50).total).toBe(0);
    db.close();
  });
});
