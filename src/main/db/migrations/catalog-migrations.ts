import catalogInitial from "./catalog/0001-initial.sql?raw";
import catalogScanState from "./catalog/0002-scan-state.sql?raw";
import type { Migration } from "./types";

export const catalogMigrations: Migration[] = [
  {
    version: 1,
    name: "initial catalog schema",
    sql: catalogInitial,
  },
  {
    version: 2,
    name: "scan state and drive stats",
    sql: catalogScanState,
  },
];
