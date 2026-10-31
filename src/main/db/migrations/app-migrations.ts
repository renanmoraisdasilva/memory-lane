import appInitial from "./app/0001-initial.sql?raw";
import type { Migration } from "./types";

export const appMigrations: Migration[] = [
  {
    version: 1,
    name: "initial app schema",
    sql: appInitial,
  },
];
