import type { DetectedDrive } from "../domain/drive";
import { getDevelopmentDrives } from "../infrastructure/development-drive";
import { listWindowsDrives } from "../infrastructure/volume-identity";

export async function listDetectedDrives(): Promise<DetectedDrive[]> {
  const windowsDrives = await listWindowsDrives();
  const developmentDrives = getDevelopmentDrives();
  return [...windowsDrives, ...developmentDrives];
}
