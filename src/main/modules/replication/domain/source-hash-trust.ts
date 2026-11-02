import type { ReplicationSourceFile } from "../../../db/repositories/replication-source-repository";

function legacyHashIsTrusted(file: ReplicationSourceFile): boolean {
  if (
    file.sourceSizeAtHash !== null ||
    file.sourceModifiedAtFsAtHash !== null ||
    file.hashedAt === null ||
    file.modifiedAtFs === null
  ) {
    return false;
  }
  const hashedAt = Date.parse(file.hashedAt);
  const modifiedAt = Date.parse(file.modifiedAtFs);
  return Number.isFinite(hashedAt) && Number.isFinite(modifiedAt) && modifiedAt <= hashedAt;
}

/**
 * Returns the stored source hash when it represents the current file, or null
 * when the file must be hashed again.
 *
 * Catalogs written before the hash-trust columns existed have no size or mtime
 * at hash time. Those hashes are still usable when the file's last modification
 * is not newer than the hash timestamp; otherwise the file changed after hashing
 * and the hash is stale.
 */
export function trustedSourceHashValue(file: ReplicationSourceFile): string | null {
  if (file.sha256 === null) {
    return null;
  }
  if (file.sourceSizeAtHash === file.size && file.sourceModifiedAtFsAtHash === file.modifiedAtFs) {
    return file.sha256;
  }
  return legacyHashIsTrusted(file) ? file.sha256 : null;
}
