import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        "@shared": resolve("src/shared"),
      },
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve("src/main/index.ts"),
          "db-worker": resolve("src/main/workers/db-worker.ts"),
          "heic-worker": resolve("src/main/workers/heic-worker.ts"),
        },
        output: {
          format: "cjs",
          entryFileNames: "[name].js",
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        "@shared": resolve("src/shared"),
      },
    },
    build: {
      rollupOptions: {
        input: resolve("src/preload/index.ts"),
        output: {
          format: "cjs",
          entryFileNames: "index.js",
        },
      },
    },
  },
  renderer: {
    root: resolve("src/renderer"),
    plugins: [react()],
    resolve: {
      alias: {
        "@renderer": resolve("src/renderer/src"),
        "@shared": resolve("src/shared"),
      },
    },
  },
});
