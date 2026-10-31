import path from "node:path";
import log from "electron-log/main";
import type { Logger } from "./types";

export function configureLogging(logDirectory: string): Logger {
  log.initialize();
  log.transports.file.resolvePathFn = () => path.join(logDirectory, "main.log");
  log.transports.file.level = "info";
  log.transports.file.maxSize = 5 * 1024 * 1024;

  const scoped = log.scope("main");
  return {
    info: (message, ...args) => scoped.info(message, ...args),
    warn: (message, ...args) => scoped.warn(message, ...args),
    error: (message, ...args) => scoped.error(message, ...args),
    debug: (message, ...args) => scoped.debug(message, ...args),
  };
}
