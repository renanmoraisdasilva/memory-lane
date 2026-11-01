import type Database from "better-sqlite3";
import { z } from "zod";
import type { RunEventType } from "@shared/contracts/replication/types";
import type { RunEventRecord } from "./replication-run-types";

const RunEventRowSchema = z.object({
  id: z.number().int().positive(),
  run_id: z.number().int().positive(),
  at: z.string().min(1),
  type: z.enum([
    "started",
    "paused",
    "resumed",
    "stop_requested",
    "plan_changed",
    "destination_added",
    "completed",
    "stopped",
    "failed",
    "interrupted",
  ]),
  plan_revision: z.number().int().positive().nullable(),
  note: z.string().nullable(),
});

export function appendRunEvent(
  db: Database.Database,
  input: {
    runId: number;
    type: RunEventType;
    at: string;
    planRevision: number | null;
    note: string | null;
  },
): RunEventRecord {
  const row = db
    .prepare(
      `INSERT INTO replication_run_events (run_id, at, type, plan_revision, note)
       VALUES (?, ?, ?, ?, ?)
       RETURNING *`,
    )
    .get(input.runId, input.at, input.type, input.planRevision, input.note);
  const parsed = RunEventRowSchema.safeParse(row);
  if (!parsed.success) {
    throw new Error("Run event row is invalid");
  }
  return {
    id: parsed.data.id,
    runId: parsed.data.run_id,
    at: parsed.data.at,
    type: parsed.data.type,
    planRevision: parsed.data.plan_revision,
    note: parsed.data.note,
  };
}

export function listRunEvents(
  db: Database.Database,
  runId: number,
  cursor: number | null,
  limit: number,
): { events: RunEventRecord[]; nextCursor: number | null } {
  const rows =
    cursor === null
      ? db
          .prepare(
            `SELECT * FROM replication_run_events
             WHERE run_id = ?
             ORDER BY id ASC
             LIMIT ?`,
          )
          .all(runId, limit + 1)
      : db
          .prepare(
            `SELECT * FROM replication_run_events
             WHERE run_id = ? AND id > ?
             ORDER BY id ASC
             LIMIT ?`,
          )
          .all(runId, cursor, limit + 1);
  const parsed = rows.flatMap((row) => {
    const event = RunEventRowSchema.safeParse(row);
    if (!event.success) {
      return [];
    }
    return [
      {
        id: event.data.id,
        runId: event.data.run_id,
        at: event.data.at,
        type: event.data.type,
        planRevision: event.data.plan_revision,
        note: event.data.note,
      },
    ];
  });
  const page = parsed.slice(0, limit);
  return {
    events: page,
    nextCursor: parsed.length > limit ? (page[page.length - 1]?.id ?? null) : null,
  };
}
