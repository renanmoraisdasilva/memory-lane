import { describe, expect, it } from "vitest";
import {
  APP_ERROR_CODES,
  AppError,
  AppErrorCodeSchema,
  isAppError,
  toAppError,
  toAppErrorPayload,
} from "./errors";

describe("AppError", () => {
  it("preserves an AppError instance", () => {
    const error = new AppError(APP_ERROR_CODES.DRIVE_NOT_FOUND, "Drive missing", {
      volumeId: "v1",
    });

    expect(toAppError(error)).toBe(error);
    expect(isAppError(error)).toBe(true);
    expect(toAppErrorPayload(error)).toEqual({
      code: "DRIVE_NOT_FOUND",
      message: "Drive missing",
      details: { volumeId: "v1" },
    });
  });

  it("wraps a normal Error as an internal error", () => {
    const error = toAppError(new Error("boom"));

    expect(error.code).toBe("INTERNAL");
    expect(error.message).toBe("boom");
    expect(error.details).toEqual({ name: "Error" });
    expect(isAppError(error)).toBe(true);
  });

  it("wraps an unknown value as an internal error", () => {
    const error = toAppError("unexpected");

    expect(error.code).toBe("INTERNAL");
    expect(error.message).toBe("Unexpected application error");
    expect(toAppErrorPayload(error)).toEqual({
      code: "INTERNAL",
      message: "Unexpected application error",
    });
  });

  it("validates known error codes", () => {
    expect(AppErrorCodeSchema.parse("CATALOG_NOT_FOUND")).toBe("CATALOG_NOT_FOUND");
    expect(() => AppErrorCodeSchema.parse("NOPE")).toThrow();
  });
});
