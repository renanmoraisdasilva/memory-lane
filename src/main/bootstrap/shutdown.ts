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
  cleanupService: Shutdownable | null;
  scanService: Shutdownable | null;
  settingsService: Shutdownable | null;
  previewService: Shutdownable | null;
  videoProxyService: Shutdownable | null;
  dbClient: Closable | null;
  logger: Logger;
}

export async function shutdownServices(dependencies: ShutdownDependencies): Promise<void> {
  dependencies.destroyTray();
  const services: Array<Shutdownable | null> = [
    dependencies.adoptionService,
    dependencies.runService,
    dependencies.healthService,
    dependencies.cleanupService,
    dependencies.scanService,
    dependencies.settingsService,
    dependencies.previewService,
    dependencies.videoProxyService,
  ];
  for (const service of services) {
    await service?.shutdown();
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
