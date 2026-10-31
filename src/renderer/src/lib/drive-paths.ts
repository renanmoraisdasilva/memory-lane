export function memoryLaneDirectory(rootPath: string): string {
  const trimmed = rootPath.replace(/[\\/]+$/, "");
  return trimmed.length === 0 ? ".memorylane" : `${trimmed}\\.memorylane`;
}

export function catalogPathForRoot(rootPath: string): string {
  return `${memoryLaneDirectory(rootPath)}\\catalog.db`;
}

export function cachePathForRoot(rootPath: string): string {
  return `${memoryLaneDirectory(rootPath)}\\cache`;
}
