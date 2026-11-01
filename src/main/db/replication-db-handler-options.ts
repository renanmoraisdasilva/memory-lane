import type Database from "better-sqlite3";
import type { CatalogRegistry } from "./catalog-registry";
import type { ReplicationDbMethod } from "./replication-worker-protocol";

export type ReplicationDbHandler = (params: unknown) => unknown;
export type ReplicationDbHandlerMap = Partial<Record<ReplicationDbMethod, ReplicationDbHandler>>;

export interface ReplicationDbHandlerOptions {
  getCatalog: () => Database.Database;
  getCatalogPath: () => string;
  getRegistry: () => CatalogRegistry;
}
