import { shell } from "electron";
import type { ShellActions } from "../application/library-service";

export function createShellActions(): ShellActions {
  return {
    reveal: (filePath) => {
      shell.showItemInFolder(filePath);
    },
    open: (filePath) => shell.openPath(filePath),
  };
}
