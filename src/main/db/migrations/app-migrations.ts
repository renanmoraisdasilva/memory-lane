import appInitial from "./app/0001-initial.sql?raw";
import appDriveStats from "./app/0002-drive-stats.sql?raw";
import appReplicationCache from "./app/0003-replication-cache.sql?raw";
import type { Migration } from "./types";

export const appMigrations: Migration[] = [
  {
    version: 1,
    name: "initial app schema",
    sql: appInitial,
  },
  {
    version: 2,
    name: "drive scan statistics",
    sql: appDriveStats,
  },
  {
    version: 3,
    name: "replication destination cache",
    sql: appReplicationCache,
  },
];
