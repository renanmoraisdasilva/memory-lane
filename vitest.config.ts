import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@main": resolve("src/main"),
      "@shared": resolve("src/shared"),
      "@renderer": resolve("src/renderer/src"),
    },
  },
  test: {
    environment: "node",
    globals: false,
    clearMocks: true,
    restoreMocks: true,
    setupFiles: ["tests/setup.ts"],
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "tests/integration/**/*.test.ts",
      "scripts/**/*.test.mjs",
    ],
    exclude: ["tests/e2e/**", "node_modules/**", "out/**", "release/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/main/index.ts",
        "src/main/workers/**",
        "src/main/bootstrap/**",
        "src/main/logging/**",
        "src/main/ipc/**",
        "src/preload/**",
        "src/renderer/src/main.tsx",
        "src/renderer/src/App.tsx",
        "src/renderer/src/env.d.ts",
        "src/shared/contracts/api.ts",
        "src/main/db/migrations/types.ts",
        "src/types/**",
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 75,
        "src/shared/**": {
          lines: 90,
          functions: 90,
          statements: 90,
          branches: 90,
        },
        "src/main/db/**": {
          lines: 90,
          functions: 90,
          statements: 90,
          branches: 90,
        },
      },
    },
  },
});
