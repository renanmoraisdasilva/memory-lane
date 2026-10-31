import { parentPort, workerData } from "node:worker_threads";
import { z } from "zod";
import { toAppErrorPayload } from "@shared/domain/errors";
import { createDbWorkerHandler } from "../db/db-worker-handler";
import { dbFailure, dbSuccess, type DbRequest } from "../db/worker-protocol";

const WorkerDataSchema = z.object({
  appDbPath: z.string().min(1),
});

if (parentPort === null) {
  throw new Error("Database worker must run inside a worker thread");
}

const parsedData = WorkerDataSchema.safeParse(workerData);
if (!parsedData.success) {
  throw new Error("Database worker received invalid workerData");
}

const handler = createDbWorkerHandler({ appDbPath: parsedData.data.appDbPath });

parentPort.on("message", (request: DbRequest) => {
  try {
    const data = handler.handle(request.method, request.params);
    parentPort?.postMessage(dbSuccess(request.id, data));
    if (request.method === "close") {
      setImmediate(() => process.exit(0));
    }
  } catch (error) {
    parentPort?.postMessage(dbFailure(request.id, toAppErrorPayload(error)));
  }
});
