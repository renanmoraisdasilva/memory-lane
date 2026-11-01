import catalogInitial from "./catalog/0001-initial.sql?raw";
import catalogScanState from "./catalog/0002-scan-state.sql?raw";
import catalogLibrary from "./catalog/0003-library.sql?raw";
import catalogDateOverrides from "./catalog/0004-date-overrides.sql?raw";
import catalogValidation from "./catalog/0005-validation.sql?raw";
import catalogFrameRate from "./catalog/0006-frame-rate.sql?raw";
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
  {
    version: 5,
    name: "validation progress and result levels",
    sql: catalogValidation,
  },
  {
    version: 6,
    name: "video frame rate",
    sql: catalogFrameRate,
  },
];
