import type {
  ThumbnailGenerator,
  ThumbnailPriority,
  ThumbnailWorkScheduler,
} from "../scanning/domain/scan-files";

interface Task {
  filePath: string;
  outputPath: string;
  resolve: (value: { bytes: number } | null) => void;
  reject: (error: unknown) => void;
}

export interface ThumbnailSchedulerLimits {
  interactive: number;
  bulk: number;
}

const DEFAULT_LIMITS: ThumbnailSchedulerLimits = {
  interactive: 4,
  bulk: 4,
};

export function createThumbnailScheduler(
  generator: ThumbnailGenerator,
  limits: ThumbnailSchedulerLimits = DEFAULT_LIMITS,
): ThumbnailWorkScheduler {
  const interactiveQueue: Task[] = [];
  const bulkQueue: Task[] = [];
  const inFlight = new Map<string, Promise<{ bytes: number } | null>>();
  let interactiveActive = 0;
  let bulkActive = 0;

  function settle(): void {
    while (interactiveActive < limits.interactive && interactiveQueue.length > 0) {
      const task = interactiveQueue.shift();
      if (task === undefined) {
        break;
      }
      start(task, "interactive");
    }

    if (interactiveQueue.length > 0) {
      return;
    }
    while (bulkActive < limits.bulk && bulkQueue.length > 0) {
      const task = bulkQueue.shift();
      if (task === undefined) {
        break;
      }
      start(task, "bulk");
    }
  }

  function start(task: Task, priority: ThumbnailPriority): void {
    if (priority === "interactive") {
      interactiveActive += 1;
    } else {
      bulkActive += 1;
    }

    void Promise.resolve()
      .then(() => generator.generate(task.filePath, task.outputPath))
      .then((result) => {
        task.resolve(result);
      })
      .catch((error: unknown) => {
        task.reject(error);
      })
      .finally(() => {
        if (priority === "interactive") {
          interactiveActive -= 1;
        } else {
          bulkActive -= 1;
        }
        inFlight.delete(task.outputPath);
        settle();
      });
  }

  function enqueue(
    filePath: string,
    outputPath: string,
    priority: ThumbnailPriority,
  ): Promise<{ bytes: number } | null> {
    const existing = inFlight.get(outputPath);
    if (existing !== undefined) {
      return existing;
    }

    const promise = new Promise<{ bytes: number } | null>((resolve, reject) => {
      const task: Task = { filePath, outputPath, resolve, reject };
      if (priority === "interactive") {
        interactiveQueue.push(task);
      } else {
        bulkQueue.push(task);
      }
      settle();
    });
    inFlight.set(outputPath, promise);
    return promise;
  }

  return {
    generate: enqueue,
  };
}
