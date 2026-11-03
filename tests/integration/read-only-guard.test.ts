import { describe, expect, it } from "vitest";

interface GuardInput {
  relativeFile: string;
  content: string;
}

type FindViolations = (inputs: GuardInput[], allowed?: Set<string>) => string[];

// @ts-expect-error - the guard is a plain ESM script without TypeScript declarations
import { findViolations } from "../../scripts/read-only-guard.mjs";

const find = findViolations as FindViolations;

describe("read-only guard [ML-SAFE-005]", () => {
  it("[ML-SAFE-001] [ML-SAFE-005] [ML-HEALTH-021] [ML-REPL-091] [ML-REPL-092] [ML-REL-002] flags a direct write outside the allowlist", () => {
    const violations = find(
      [{ relativeFile: "src/main/bad.ts", content: 'await writeFile("x", "y");' }],
      new Set(),
    );
    expect(violations).toHaveLength(1);
  });

  it("[ML-SAFE-005] [ML-REPL-091] [ML-REL-002] permits an allowlisted writer", () => {
    const violations = find(
      [{ relativeFile: "src/main/allowed.ts", content: 'await writeFile("x", "y");' }],
      new Set(["src/main/allowed.ts"]),
    );
    expect(violations).toEqual([]);
  });
});
