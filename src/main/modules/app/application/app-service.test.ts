import { describe, expect, it } from "vitest";
import { AppError } from "@shared/domain/errors";
import type { DbClient } from "../../../clients/db-client";
import type { DbMethod } from "../../../db/worker-protocol";
import { AppService } from "./app-service";

class HealthDb implements DbClient {
  constructor(private readonly error?: Error) {}

  async request<T>(_method: DbMethod, _params: unknown): Promise<T> {
    if (this.error !== undefined) {
      throw this.error;
    }
    return { appDbPath: "C:\\data\\app.db", schemaVersion: 1 } as T;
  }
}

const baseDependencies = {
  appDbPath: "C:\\data\\app.db",
  userDataPath: "C:\\data",
  logPath: "C:\\data\\logs",
  appVersion: "0.1.0",
  electronVersion: "39.0.0",
  platform: "win32",
  isPackaged: false,
};

describe("AppService", () => {
  it("reports a healthy database", async () => {
    const service = new AppService({ ...baseDependencies, db: new HealthDb() });
    const info = await service.getInfo();

    expect(info.database.state).toBe("ready");
    expect(info.database.schemaVersion).toBe(1);
    expect(info.appVersion).toBe("0.1.0");
  });

  it("reports a database error without failing app info", async () => {
    const service = new AppService({
      ...baseDependencies,
      db: new HealthDb(new AppError("DB_ERROR", "database unavailable")),
    });
    const info = await service.getInfo();

    expect(info.database.state).toBe("error");
    expect(info.database.message).toBe("database unavailable");
  });
});
