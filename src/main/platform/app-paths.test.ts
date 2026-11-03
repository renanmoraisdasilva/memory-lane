import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildAppPaths } from "./app-paths";

describe("app paths", () => {
  it("[ML-SET-005] builds app-managed paths from a base directory", () => {
    const base = path.resolve("fixtures", "memory-lane");
    const paths = buildAppPaths(base);

    expect(paths.userDataPath).toBe(base);
    expect(paths.appDbPath).toBe(path.join(base, "app.db"));
    expect(paths.logPath).toBe(path.join(base, "logs"));
    expect(paths.backupsPath).toBe(path.join(base, "backups"));
    expect(paths.sessionDataPath).toBe(path.join(base, "session"));
  });

  it("normalizes a relative base", () => {
    const paths = buildAppPaths("fixtures/memory-lane");
    expect(path.isAbsolute(paths.userDataPath)).toBe(true);
  });
});
