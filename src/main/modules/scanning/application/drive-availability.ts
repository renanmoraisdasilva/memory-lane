import fs from "node:fs/promises";

export async function assertDriveAvailable(rootPath: string): Promise<void> {
  await fs.access(rootPath);
}
