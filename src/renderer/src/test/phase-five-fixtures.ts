import type { OtherFilesPage } from "@shared/contracts/other-files";
import type { SettingsInfo } from "@shared/contracts/settings";
import type { ValidationState } from "@shared/contracts/health";

export const idleValidation: ValidationState = {
  sessionId: null,
  status: "idle",
  levels: [],
  total: 0,
  processed: 0,
  currentLevel: null,
  startedAt: null,
  finishedAt: null,
  errorMessage: null,
  report: null,
};

export const settingsFixture: SettingsInfo = {
  appVersion: "0.1.0",
  electronVersion: "42.11.18",
  platform: "win32",
  isPackaged: false,
  offline: true,
  cache: {
    path: "C:\\archive\\cache",
    bytes: 12 * 1024 ** 2,
    files: 12,
  },
  catalog: {
    path: "C:\\archive\\catalog.db",
    bytes: 24 * 1024 ** 2,
  },
  backup: {
    path: "C:\\Users\\tester\\AppData\\Local\\MemoryLane\\backups\\volume-1",
    lastBackupAt: null,
    lastStatus: null,
    lastBytes: null,
  },
};

export const otherFilesFixture: OtherFilesPage = {
  items: [],
  total: 0,
  counts: {
    all: 0,
    documents: 0,
    spreadsheets: 0,
    presentations: 0,
    pdfs: 0,
    audio: 0,
    archives: 0,
    other: 0,
  },
};
