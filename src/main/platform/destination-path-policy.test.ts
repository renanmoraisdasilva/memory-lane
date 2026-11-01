import path from "node:path";
import { describe, expect, it } from "vitest";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import {
  assertDifferentVolume,
  assertNoRootOverlap,
  assertRelativePath,
  relativePathKey,
  resolveRelativePath,
} from "./destination-path-policy";

describe("destination path policy", () => {
  it("accepts only relative destination paths", () => {
    expect(assertRelativePath("Memory Lane\\4TB Archive\\a.jpg")).toBe(
      "Memory Lane\\4TB Archive\\a.jpg",
    );
    expect(assertRelativePath("photos/a.jpg")).toBe("photos\\a.jpg");

    expect(() => assertRelativePath("C:\\escape.jpg")).toThrow(AppError);
    expect(() => assertRelativePath("\\\\server\\share\\a.jpg")).toThrow(AppError);
    expect(() => assertRelativePath("..\\escape.jpg")).toThrow(AppError);
    expect(() => assertRelativePath("photos\\..\\..\\escape.jpg")).toThrow(AppError);
    expect(() => assertRelativePath("")).toThrow(AppError);
  });

  it("resolves a relative path inside its root", () => {
    const root = path.resolve("C:\\backup");
    expect(resolveRelativePath(root, "photos\\a.jpg")).toBe(
      path.resolve("C:\\backup\\photos\\a.jpg"),
    );
    expect(() => resolveRelativePath(root, "..\\outside.jpg")).toThrow(AppError);
  });

  it("rejects overlapping source and destination roots", () => {
    expect(() => assertNoRootOverlap("C:\\source", "D:\\backup")).not.toThrow();
    expect(() => assertNoRootOverlap("C:\\source", "C:\\source")).toThrow(AppError);
    expect(() => assertNoRootOverlap("C:\\source", "C:\\source\\backup")).toThrow(AppError);
    expect(() => assertNoRootOverlap("C:\\source\\backup", "C:\\source")).toThrow(AppError);
  });

  it("rejects the same volume", () => {
    expect(() => assertDifferentVolume("volume-1", "volume-2")).not.toThrow();
    try {
      assertDifferentVolume("volume-1", "volume-1");
    } catch (error) {
      expect((error as AppError).code).toBe(APP_ERROR_CODES.DESTINATION_OVERLAP);
    }
  });

  it("normalizes case-insensitive path keys", () => {
    expect(relativePathKey("Photos\\A.JPG")).toBe("photos\\a.jpg");
    expect(relativePathKey("photos/a.jpg")).toBe("photos\\a.jpg");
  });
});
