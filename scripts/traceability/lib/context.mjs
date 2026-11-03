import path from "node:path";

export const SCHEMA_VERSION = 2;
export const ID_SOURCE = /\[(ML-[A-Z]+-\d{3})\]/g;
export const ID_PATTERN = /^ML-[A-Z]+-\d{3}$/;
export const TEST_FILE_PATTERN = /\.(test|spec)\.(ts|tsx|mjs|js)$/;
export const VITEST_FILE_PATTERN = /\.test\.(ts|tsx|mjs|js)$/;
export const E2E_PREFIX = "tests/e2e/";

export function createContext(root) {
  const docs = path.join(root, "docs");
  return {
    root,
    ledgerPath: path.join(docs, "traceability", "requirements.json"),
    reviewDir: path.join(docs, "traceability", "reviews"),
    matrixPath: path.join(docs, "traceability", "matrix.md"),
    conflictsPath: path.join(docs, "traceability", "conflicts.md"),
    resultsPath: path.join(docs, "traceability", "test-results.json"),
    contractsDir: path.join(docs, "contracts"),
    adrDir: path.join(docs, "adr"),
    adrIndexPath: path.join(docs, "adr", "README.md"),
    docsDir: docs,
    docsIndexPath: path.join(docs, "README.md"),
    migrationsDir: path.join(root, "src", "main", "db", "migrations", "catalog"),
    scanRoots: ["src", "tests", "scripts"].map((dir) => path.join(root, dir)),
    headingCache: new Map(),
  };
}

export function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

export function relative(context, filePath) {
  return toPosix(path.relative(context.root, filePath));
}

export function idsIn(text) {
  return [...text.matchAll(ID_SOURCE)].map((match) => match[1]);
}
