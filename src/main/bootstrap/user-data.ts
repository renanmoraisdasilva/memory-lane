import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import { buildAppPaths, type AppPaths } from "../platform/app-paths";

export function configureUserData(): AppPaths {
  const localAppData = process.env.LOCALAPPDATA;
  if (localAppData === undefined) {
    throw new Error("LOCALAPPDATA is not available");
  }
  const defaultDirectoryName = app.isPackaged ? "MemoryLane" : "MemoryLane-dev";
  const baseDirectory =
    process.env.MEMORY_LANE_USER_DATA?.trim() || path.join(localAppData, defaultDirectoryName);
  const paths = buildAppPaths(baseDirectory);

  fs.mkdirSync(paths.userDataPath, { recursive: true });
  fs.mkdirSync(paths.logPath, { recursive: true });
  fs.mkdirSync(paths.backupsPath, { recursive: true });
  fs.mkdirSync(paths.sessionDataPath, { recursive: true });

  app.setPath("userData", paths.userDataPath);
  app.setPath("sessionData", paths.sessionDataPath);

  return paths;
}
