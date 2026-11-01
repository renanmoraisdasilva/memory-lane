import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { AppError } from "@shared/domain/errors";
import { createScanDbHandlers } from "./scan-db-handlers";

describe("scan database handlers", () => {
  it("rejects unknown methods", () => {
    const db = new Database(":memory:");
    const handler = createScanDbHandlers({
      getCatalog: () => db,
      getAppDb: () => db,
    });
    expect(() => handler.handle("scan.unknown" as never, {})).toThrow(AppError);
    db.close();
  });
});
