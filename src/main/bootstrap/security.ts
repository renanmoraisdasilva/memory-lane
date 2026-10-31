import { app, session } from "electron";

export function installSecurityHandlers(): void {
  app.on("web-contents-created", (_event, contents) => {
    contents.setWindowOpenHandler(() => ({ action: "deny" }));

    contents.on("will-navigate", (event) => {
      event.preventDefault();
    });

    contents.on("will-attach-webview", (event) => {
      event.preventDefault();
    });
  });

  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  session.defaultSession.setPermissionCheckHandler(() => false);
}
