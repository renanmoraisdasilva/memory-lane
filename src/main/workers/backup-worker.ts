import { parentPort, workerData } from "node:worker_threads";
import { toAppErrorPayload } from "@shared/domain/errors";
import {
  DatabaseBackupWorkerDataSchema,
  type DatabaseBackupWorkerMessage,
} from "../db/backup-protocol";
import { runDatabaseBackup } from "../db/backup-runner";

// SQLite's backup API copies most pages in one synchronous step. Running it in
// the shared database worker would block every UI query and adoption write.
if (parentPort === null) {
  throw new Error("Database backup worker must run inside a worker thread");
}

const parsedData = DatabaseBackupWorkerDataSchema.safeParse(workerData);
if (!parsedData.success) {
  throw new Error("Database backup worker received invalid workerData");
}

function post(message: DatabaseBackupWorkerMessage): void {
  parentPort?.postMessage(message);
}

runDatabaseBackup(parsedData.data).then(
  (result) => {
    post({ ok: true, result });
  },
  (error: unknown) => {
    post({ ok: false, error: toAppErrorPayload(error) });
  },
);
