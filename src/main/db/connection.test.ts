import { access, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DATABASE_CACHE_SIZE_KIB, openDatabase } from "./connection";

describe("database connection", () => {
  it("keeps a larger page cache for large catalogs", () => {
    const db = openDatabase(":memory:");
    try {
      expect(db.pragma("cache_size", { simple: true })).toBe(-DATABASE_CACHE_SIZE_KIB);
      expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
      expect(db.pragma("synchronous", { simple: true })).toBe(1);
      expect(db.pragma("busy_timeout", { simple: true })).toBe(5000);
    } finally {
      db.close();
    }
  });

  it("accepts a longer busy timeout for background maintenance", () => {
    const db = openDatabase(":memory:", { busyTimeoutMs: 30_000 });
    try {
      expect(db.pragma("busy_timeout", { simple: true })).toBe(30_000);
    } finally {
      db.close();
    }
  });

  it("[ML-SAFE-008] [ML-SAFE-010] opens a read-only connection for database backups", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "memory-lane-connection-"));
    const filePath = path.join(root, "catalog.db");
    const backupPath = path.join(root, "catalog-backup.db");
    const writable = openDatabase(filePath);
    try {
      writable.exec("CREATE TABLE sample (id INTEGER PRIMARY KEY)");

      const readonly = openDatabase(filePath, { readonly: true });
      try {
        expect(readonly.readonly).toBe(true);
        expect(() => readonly.exec("INSERT INTO sample DEFAULT VALUES")).toThrow();
        await expect(readonly.backup(backupPath)).resolves.toBeDefined();
      } finally {
        readonly.close();
      }
      await expect(access(backupPath)).resolves.toBeUndefined();
    } finally {
      writable.close();
      await rm(root, { recursive: true, force: true });
    }
  });
});
