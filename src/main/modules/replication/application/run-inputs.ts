import { z } from "zod";
import type { RunOrderEntry } from "@shared/contracts/replication/types";
import { RunOrderEntrySchema } from "@shared/contracts/replication/types";

export function parseOrderSnapshot(value: string | null): RunOrderEntry[] {
  if (value === null) {
    return [];
  }
  try {
    const parsed = z.array(RunOrderEntrySchema).safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}
