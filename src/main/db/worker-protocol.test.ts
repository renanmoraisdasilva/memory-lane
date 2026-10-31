import { describe, expect, it } from "vitest";
import {
  CatalogCreateParamsSchema,
  CatalogOpenParamsSchema,
  RegisterDriveParamsSchema,
  dbFailure,
  dbSuccess,
  isDbResponse,
} from "./worker-protocol";
import { toVolumeId } from "@shared/contracts/drives";

const identity = {
  volumeId: toVolumeId("volume-1"),
  serialNumber: "SERIAL",
  label: "Archive",
  fileSystem: "NTFS",
  rootPath: "E:\\",
  letter: "E:",
};

describe("database worker protocol", () => {
  it("validates catalog creation params", () => {
    const parsed = CatalogCreateParamsSchema.parse({
      catalogPath: "E:\\catalog.db",
      cachePath: "E:\\cache",
      identity,
      catalogSchema: 1,
    });

    expect(parsed.catalogPath).toBe("E:\\catalog.db");
    expect(() =>
      CatalogCreateParamsSchema.parse({
        catalogPath: "",
        cachePath: "E:\\cache",
        identity,
        catalogSchema: 1,
      }),
    ).toThrow();
  });

  it("validates catalog open and register params", () => {
    expect(
      CatalogOpenParamsSchema.parse({ catalogPath: "E:\\catalog.db", identity }).identity,
    ).toEqual(identity);
    expect(
      RegisterDriveParamsSchema.parse({
        identity,
        lastSeenAt: "2026-01-01T00:00:00.000Z",
        catalogSchema: 1,
      }).catalogSchema,
    ).toBe(1);
  });

  it("builds success and failure responses", () => {
    expect(dbSuccess(1, { ok: true })).toEqual({ id: 1, ok: true, data: { ok: true } });
    expect(
      dbFailure(2, { code: "DB_ERROR", message: "failed", details: { table: "files" } }),
    ).toEqual({
      id: 2,
      ok: false,
      error: { code: "DB_ERROR", message: "failed", details: { table: "files" } },
    });
  });

  it("recognizes response envelopes", () => {
    expect(isDbResponse({ id: 1, ok: true, data: {} })).toBe(true);
    expect(isDbResponse({ id: 1, ok: false, error: {} })).toBe(true);
    expect(isDbResponse({ id: "1", ok: true })).toBe(false);
    expect(isDbResponse(null)).toBe(false);
    expect(isDbResponse("nope")).toBe(false);
  });
});
