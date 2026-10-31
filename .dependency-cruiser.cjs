module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "renderer-no-main",
      severity: "error",
      from: { path: "^src/renderer" },
      to: { path: "^src/(main|preload)" },
    },
    {
      name: "renderer-no-node-or-electron",
      severity: "error",
      from: { path: "^src/renderer" },
      to: {
        path: "^(node:|electron$|better-sqlite3|fs$|path$|crypto$|worker_threads$)",
      },
    },
    {
      name: "shared-platform-neutral",
      severity: "error",
      from: { path: "^src/shared" },
      to: {
        path: "^(node:|electron$|react$|react-dom$|better-sqlite3|@main|@renderer|src/(main|renderer|preload))",
      },
    },
    {
      name: "main-no-renderer",
      severity: "error",
      from: { path: "^src/main" },
      to: { path: "^src/renderer" },
    },
    {
      name: "preload-only-shared",
      severity: "error",
      from: { path: "^src/preload" },
      to: { path: "^(src/(main|renderer)|node:|better-sqlite3)" },
    },
    {
      name: "domain-no-infrastructure",
      severity: "error",
      from: { path: "^src/main/modules/[^/]+/domain" },
      to: { path: "^src/main/modules/[^/]+/infrastructure" },
    },
    {
      name: "only-db-worker-imports-sqlite",
      severity: "error",
      from: {
        path: "^src/main",
        pathNot: "^src/main/(workers/db-worker|db/)",
      },
      to: { path: "node_modules/better-sqlite3" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "node_modules|out|release|coverage|test-results|playwright-report" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
    },
  },
};
