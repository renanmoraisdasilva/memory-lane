import type {
  ReplicationDbHandlerMap,
  ReplicationDbHandlerOptions,
} from "./replication-db-handler-options";
import { openDestinationCatalog } from "./replication-destination-library-db-handlers";
import { getDestination } from "./repositories/replication-destination-repository";
import {
  getDestinationLibraryContext,
  resolveDestinationCacheEntry,
  resolveDestinationMediaFile,
  saveDestinationPreview,
  saveDestinationThumbnail,
} from "./repositories/destination-library-media-repository";
import {
  DestinationLibraryContextParamsSchema,
  DestinationLibraryMediaParamsSchema,
  DestinationLibrarySaveCacheParamsSchema,
} from "./replication-worker-protocol";

export function createDestinationLibraryMediaDbHandlers(
  options: ReplicationDbHandlerOptions,
): ReplicationDbHandlerMap {
  return {
    "destinationLibrary.getContext": (params) => {
      const parsed = DestinationLibraryContextParamsSchema.parse(params);
      const destination = openDestinationCatalog(
        options,
        parsed.destinationId,
        parsed.destinationRoot,
      );
      const record = getDestination(options.getCatalog(), parsed.destinationId);
      const catalogPath = options.getRegistry().getDestinationPath(record.destinationId);
      return getDestinationLibraryContext(destination, catalogPath);
    },
    "destinationLibrary.resolveMedia": (params) => {
      const parsed = DestinationLibraryMediaParamsSchema.parse(params);
      const destination = openDestinationCatalog(
        options,
        parsed.destinationId,
        parsed.destinationRoot,
      );
      return resolveDestinationMediaFile(destination, parsed.destinationRoot, parsed.fileId);
    },
    "destinationLibrary.resolveThumbnail": (params) => {
      const parsed = DestinationLibraryMediaParamsSchema.parse(params);
      const destination = openDestinationCatalog(
        options,
        parsed.destinationId,
        parsed.destinationRoot,
      );
      return resolveDestinationCacheEntry(
        destination,
        parsed.destinationRoot,
        parsed.fileId,
        "thumbnail",
      );
    },
    "destinationLibrary.resolvePreview": (params) => {
      const parsed = DestinationLibraryMediaParamsSchema.parse(params);
      const destination = openDestinationCatalog(
        options,
        parsed.destinationId,
        parsed.destinationRoot,
      );
      return resolveDestinationCacheEntry(
        destination,
        parsed.destinationRoot,
        parsed.fileId,
        "preview",
      );
    },
    "destinationLibrary.saveThumbnail": (params) => {
      const parsed = DestinationLibrarySaveCacheParamsSchema.parse(params);
      const destination = openDestinationCatalog(
        options,
        parsed.destinationId,
        parsed.destinationRoot,
      );
      saveDestinationThumbnail(destination, parsed);
      return { saved: true };
    },
    "destinationLibrary.savePreview": (params) => {
      const parsed = DestinationLibrarySaveCacheParamsSchema.parse(params);
      const destination = openDestinationCatalog(
        options,
        parsed.destinationId,
        parsed.destinationRoot,
      );
      saveDestinationPreview(destination, parsed);
      return { saved: true };
    },
  };
}
