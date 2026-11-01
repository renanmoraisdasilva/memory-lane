export interface AdoptionSourceFile {
  id: number;
  sourceRelativePath: string;
  name: string;
  size: number;
  state: "present" | "missing";
  sha256: string | null;
}

export interface AdoptionDestinationFile {
  relativePath: string;
  name: string;
  size: number;
}

export interface AdoptionIndex {
  byPathSize: Map<string, AdoptionSourceFile[]>;
  byNameSize: Map<string, AdoptionSourceFile[]>;
  byHash: Map<string, AdoptionSourceFile[]>;
}

export type AdoptionMatch =
  | {
      kind: "matched";
      source: AdoptionSourceFile;
      sourceRelativePath: string;
      matchedBy: "path" | "name" | "hash";
    }
  | { kind: "ambiguous"; matches: number }
  | { kind: "none" };

export type ReplicaOutcome = "verified" | "stale" | "conflict";

export function pathKey(value: string): string {
  return value.replaceAll("/", "\\").replaceAll(/\s+/g, " ").trim().toLowerCase();
}

function push(map: Map<string, AdoptionSourceFile[]>, key: string, file: AdoptionSourceFile): void {
  const existing = map.get(key);
  if (existing === undefined) {
    map.set(key, [file]);
    return;
  }
  existing.push(file);
}

function pathSizeKey(relativePath: string, size: number): string {
  return `${pathKey(relativePath)}\u0000${String(size)}`;
}

function nameSizeKey(name: string, size: number): string {
  return `${pathKey(name)}\u0000${String(size)}`;
}

export function buildAdoptionIndex(files: AdoptionSourceFile[]): AdoptionIndex {
  const byPathSize = new Map<string, AdoptionSourceFile[]>();
  const byNameSize = new Map<string, AdoptionSourceFile[]>();
  const byHash = new Map<string, AdoptionSourceFile[]>();
  for (const file of files) {
    push(byPathSize, pathSizeKey(file.sourceRelativePath, file.size), file);
    push(byNameSize, nameSizeKey(file.name, file.size), file);
    if (file.sha256 !== null) {
      push(byHash, file.sha256.toLowerCase(), file);
    }
  }
  return { byPathSize, byNameSize, byHash };
}

export function stripCopyRoot(relativePath: string, copyRootRelative: string | null): string {
  if (copyRootRelative === null || copyRootRelative.trim().length === 0) {
    return relativePath;
  }
  const path = pathKey(relativePath);
  const root = pathKey(copyRootRelative).replace(/\\+$/u, "");
  if (path === root) {
    return "";
  }
  if (path.startsWith(`${root}\\`)) {
    return relativePath.slice(copyRootRelative.length + 1);
  }
  return relativePath;
}

function resolvePath(size: number, keys: string[], index: AdoptionIndex): AdoptionSourceFile[] {
  for (const key of keys) {
    const candidates = index.byPathSize.get(pathSizeKey(key, size));
    if (candidates !== undefined && candidates.length > 0) {
      return candidates;
    }
  }
  return [];
}

export function matchDestinationFile(
  index: AdoptionIndex,
  file: AdoptionDestinationFile,
  copyRootRelative: string | null,
): AdoptionMatch {
  const stripped = stripCopyRoot(file.relativePath, copyRootRelative);
  const pathCandidates = resolvePath(file.size, [stripped, file.relativePath], index);
  if (pathCandidates.length === 1) {
    const source = pathCandidates[0];
    if (source !== undefined) {
      return {
        kind: "matched",
        source,
        sourceRelativePath: source.sourceRelativePath,
        matchedBy: "path",
      };
    }
  }
  if (pathCandidates.length > 1) {
    return { kind: "ambiguous", matches: pathCandidates.length };
  }

  const nameCandidates = index.byNameSize.get(nameSizeKey(file.name, file.size)) ?? [];
  if (nameCandidates.length === 1) {
    const source = nameCandidates[0];
    if (source !== undefined) {
      return {
        kind: "matched",
        source,
        sourceRelativePath: source.sourceRelativePath,
        matchedBy: "name",
      };
    }
  }
  if (nameCandidates.length > 1) {
    return { kind: "ambiguous", matches: nameCandidates.length };
  }
  return { kind: "none" };
}

export function matchByHash(index: AdoptionIndex, sha256: string): AdoptionMatch {
  const candidates = index.byHash.get(sha256.toLowerCase()) ?? [];
  if (candidates.length === 1) {
    const source = candidates[0];
    if (source !== undefined) {
      return {
        kind: "matched",
        source,
        sourceRelativePath: source.sourceRelativePath,
        matchedBy: "hash",
      };
    }
  }
  if (candidates.length > 1) {
    return { kind: "ambiguous", matches: candidates.length };
  }
  return { kind: "none" };
}

export function classifyReplicaOutcome(input: {
  sourceHash: string;
  destinationHash: string;
  previous: { status: string; sha256: string | null } | null;
}): ReplicaOutcome {
  if (input.sourceHash.toLowerCase() === input.destinationHash.toLowerCase()) {
    return "verified";
  }
  const previous = input.previous;
  if (previous === null || previous.status !== "verified" || previous.sha256 === null) {
    return "conflict";
  }
  const previousHash = previous.sha256.toLowerCase();
  const sourceChanged = input.sourceHash.toLowerCase() !== previousHash;
  const destinationChanged = input.destinationHash.toLowerCase() !== previousHash;
  return sourceChanged !== destinationChanged ? "stale" : "conflict";
}
