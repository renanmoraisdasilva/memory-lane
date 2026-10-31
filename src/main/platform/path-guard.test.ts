import path from "node:path";
import { describe, expect, it } from "vitest";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import { assertPathInside, isPathInside } from "./path-guard";

const root = path.resolve("fixtures", "archive");

describe("path guard", () => {
  it("accepts the root itself and descendants", () => {
    expect(isPathInside(root, root)).toBe(true);
    expect(isPathInside(root, path.join(root, "2024", "photo.jpg"))).toBe(true);
  });

  it("rejects siblings and parent paths", () => {
    expect(isPathInside(root, path.join(root, "..", "other"))).toBe(false);
    expect(isPathInside(root, path.join(root, ".."))).toBe(false);
  });

  it("rejects a path with a shared prefix but different directory", () => {
    expect(isPathInside(root, `${root}-backup`)).toBe(false);
  });

  it("throws a forbidden AppError outside the root", () => {
    expect(() => assertPathInside(root, path.resolve("elsewhere"))).toThrow(AppError);
    try {
      assertPathInside(root, path.resolve("elsewhere"));
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(APP_ERROR_CODES.FORBIDDEN);
    }
  });
});
