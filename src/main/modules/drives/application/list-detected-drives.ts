import type { DetectedDrive } from "../domain/drive";
import { getDevelopmentDrive } from "../infrastructure/development-drive";
import { listWindowsDrives } from "../infrastructure/volume-identity";

export async function listDetectedDrives(): Promise<DetectedDrive[]> {
  const windowsDrives = await listWindowsDrives();
  const developmentDrive = getDevelopmentDrive();
  return developmentDrive === null ? windowsDrives : [...windowsDrives, developmentDrive];
}
