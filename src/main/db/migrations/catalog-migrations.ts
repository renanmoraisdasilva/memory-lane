import catalogInitial from "./catalog/0001-initial.sql?raw";
import catalogScanState from "./catalog/0002-scan-state.sql?raw";
import catalogLibrary from "./catalog/0003-library.sql?raw";
import catalogDateOverrides from "./catalog/0004-date-overrides.sql?raw";
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
  {
    version: 3,
    name: "library media columns and timeline index",
    sql: catalogLibrary,
  },
  {
    version: 4,
    name: "date override extraction fields",
    sql: catalogDateOverrides,
  },
];
