import catalogInitial from "./catalog/0001-initial.sql?raw";
import type { Migration } from "./types";

export const catalogMigrations: Migration[] = [
  {
    version: 1,
    name: "initial catalog schema",
    sql: catalogInitial,
  },
];
