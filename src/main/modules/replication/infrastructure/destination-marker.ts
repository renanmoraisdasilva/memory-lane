import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { DestinationGoalSchema } from "@shared/contracts/replication/types";
import type { DestinationWriter } from "./destination-writer";

export const DestinationMarkerSchema = z.object({
  schemaVersion: z.literal(1),
  catalogId: z.string().min(1),
  destinationId: z.string().min(1),
  sourceLabel: z.string().min(1),
  sourceVolumeId: z.string().min(1),
  rootRelative: z.string(),
  copyRootRelative: z.string().nullable(),
  replicaGoal: DestinationGoalSchema,
  replicaLayout: z.enum(["dedicated", "mirror_source"]),
  localCatalogId: z.string().min(1).nullable(),
  localCatalogRelative: z.string().nullable(),
  sourceIndexRelative: z.string().nullable(),
  updatedAt: z.string().min(1),
});
export type DestinationMarker = z.infer<typeof DestinationMarkerSchema>;

export function markerRelativePath(catalogId: string): string {
  return path.join(".memorylane", "replicas", `${catalogId}.json`);
}

export function markerDirectoryRelativePath(): string {
  return path.join(".memorylane", "replicas");
}

export async function readMarker(
  rootPath: string,
  catalogId: string,
): Promise<DestinationMarker | null> {
  try {
    const text = await readFile(path.join(rootPath, markerRelativePath(catalogId)), "utf8");
    const parsed = DestinationMarkerSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function readAnyMarker(rootPath: string): Promise<DestinationMarker | null> {
  try {
    const directory = path.join(rootPath, markerDirectoryRelativePath());
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) {
        continue;
      }
      try {
        const text = await readFile(path.join(directory, entry.name), "utf8");
        const parsed = DestinationMarkerSchema.safeParse(JSON.parse(text));
        if (parsed.success) {
          return parsed.data;
        }
      } catch {
        // Try the next marker.
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function writeMarker(
  writer: DestinationWriter,
  marker: DestinationMarker,
): Promise<void> {
  const parsed = DestinationMarkerSchema.parse(marker);
  await writer.writeText(
    markerRelativePath(parsed.catalogId),
    `${JSON.stringify(parsed, null, 2)}\n`,
  );
}
