import path from "node:path";

export interface AppPaths {
  userDataPath: string;
  appDbPath: string;
  logPath: string;
  backupsPath: string;
  sessionDataPath: string;
}

export function buildAppPaths(baseDirectory: string): AppPaths {
  const userDataPath = path.resolve(baseDirectory);
  return {
    userDataPath,
    appDbPath: path.join(userDataPath, "app.db"),
    logPath: path.join(userDataPath, "logs"),
    backupsPath: path.join(userDataPath, "backups"),
    sessionDataPath: path.join(userDataPath, "session"),
  };
}
