/// <reference types="vite/client" />

import type { MemoryLaneApi } from "@shared/contracts/api";

declare global {
  interface Window {
    memoryLane?: MemoryLaneApi;
  }
}

export {};
