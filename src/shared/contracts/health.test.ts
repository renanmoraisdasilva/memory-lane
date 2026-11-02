import { describe, expect, it } from "vitest";
import { MovedCandidateTargetsSchema, MovedDismissTargetsSchema } from "./health";

const candidateIds = Array.from({ length: 501 }, (_, index) => index + 1);

describe("moved candidate target schemas", () => {
  it("keeps move confirmation capped at 500 candidates", () => {
    expect(MovedCandidateTargetsSchema.safeParse({ candidateIds }).success).toBe(false);
  });

  it("allows bulk dismissal beyond the confirmation cap", () => {
    expect(MovedDismissTargetsSchema.safeParse({ candidateIds }).success).toBe(true);
  });
});
