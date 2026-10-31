import { describe, expect, it } from "vitest";
import {
  OtherFileCategoryCountsSchema,
  OtherFilesParamsSchema,
  OtherFilesPageSchema,
} from "./other-files";
import {
  BackupResultSchema,
  BackupStateSchema,
  CacheClearResultSchema,
  SettingsInfoSchema,
} from "./settings";

const settings = {
  appVersion: "0.1.0",
  electronVersion: "42.11.18",
  platform: "win32",
  isPackaged: false,
  offline: true as const,
  cache: { path: "C:\\archive\\cache", bytes: 10, files: 1 },
  catalog: { path: "C:\\archive\\catalog.db", bytes: 100 },
  backup: {
    path: "C:\\backups\\volume-1",
    lastBackupAt: null,
    lastStatus: null,
    lastBytes: null,
  },
};

describe("phase five contracts", () => {
  it("validates Other files params and pages", () => {
    expect(OtherFilesParamsSchema.parse({})).toEqual({});
    expect(OtherFilesParamsSchema.parse({ category: "pdfs", offset: 0, limit: 50 })).toEqual({
      category: "pdfs",
      offset: 0,
      limit: 50,
    });
    expect(() => OtherFilesParamsSchema.parse({ category: "music" })).toThrow();
    expect(() => OtherFilesParamsSchema.parse({ limit: 500 })).toThrow();

    const counts = OtherFileCategoryCountsSchema.parse({
      all: 1,
      documents: 0,
      spreadsheets: 0,
      presentations: 0,
      pdfs: 1,
      audio: 0,
      archives: 0,
      other: 0,
    });
    expect(counts.all).toBe(1);
    expect(
      OtherFilesPageSchema.parse({
        items: [
          {
            fileId: 1,
            name: "manual.pdf",
            path: "C:\\archive\\manual.pdf",
            folder: "C:\\archive",
            extension: "pdf",
            format: "PDF",
            mime: "application/pdf",
            category: "pdfs",
            sizeBytes: 10,
            modifiedAtFs: null,
            state: "present",
          },
        ],
        total: 1,
        counts,
      }).items[0]?.category,
    ).toBe("pdfs");
  });

  it("validates Settings, cache, and backup payloads", () => {
    expect(SettingsInfoSchema.parse(settings).offline).toBe(true);
    expect(() => SettingsInfoSchema.parse({ ...settings, offline: false })).toThrow();
    expect(CacheClearResultSchema.parse({ removedFiles: 2, freedBytes: 20 })).toEqual({
      removedFiles: 2,
      freedBytes: 20,
    });
    expect(
      BackupResultSchema.parse({
        path: "C:\\backups\\catalog.db",
        bytes: 100,
        createdAt: "2026-10-31T12:00:00.000Z",
        status: "success",
      }).status,
    ).toBe("success");
    expect(
      BackupStateSchema.parse({
        lastBackupAt: null,
        lastStatus: null,
        lastPath: null,
        lastBytes: null,
      }).lastStatus,
    ).toBeNull();
    expect(() => BackupStateSchema.parse({ lastStatus: "maybe" })).toThrow();
  });
});
