import type { Logger } from "../logging/types";

interface Shutdownable {
  shutdown(): Promise<void>;
}

interface Closable {
  close(): Promise<void>;
}

export interface ShutdownDependencies {
  destroyTray: () => void;
  adoptionService: Shutdownable | null;
  runService: Shutdownable | null;
  healthService: Shutdownable | null;
  scanService: Shutdownable | null;
  settingsService: Shutdownable | null;
  previewService: Shutdownable | null;
  videoProxyService: Shutdownable | null;
  dbClient: Closable | null;
  logger: Logger;
}

export async function shutdownServices(dependencies: ShutdownDependencies): Promise<void> {
  dependencies.destroyTray();
  if (dependencies.adoptionService !== null) {
    await dependencies.adoptionService.shutdown();
  }
  if (dependencies.runService !== null) {
    await dependencies.runService.shutdown();
  }
  if (dependencies.healthService !== null) {
    await dependencies.healthService.shutdown();
  }
  if (dependencies.scanService !== null) {
    await dependencies.scanService.shutdown();
  }
  if (dependencies.settingsService !== null) {
    await dependencies.settingsService.shutdown();
  }
  if (dependencies.previewService !== null) {
    await dependencies.previewService.shutdown();
  }
  if (dependencies.videoProxyService !== null) {
    await dependencies.videoProxyService.shutdown();
  }
  if (dependencies.dbClient !== null) {
    try {
      await dependencies.dbClient.close();
      dependencies.logger.info("Database worker closed");
    } catch (error) {
      dependencies.logger.error("Failed to close database worker", error);
    }
  }
}
