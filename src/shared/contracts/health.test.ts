import { describe, expect, it } from "vitest";
import {
  MissingFileTargetsSchema,
  MissingFilesParamsSchema,
  MovedCandidateTargetsSchema,
  MovedDismissTargetsSchema,
} from "./health";

const candidateIds = Array.from({ length: 501 }, (_, index) => index + 1);
const fileIds = Array.from({ length: 50_001 }, (_, index) => index + 1);

describe("moved candidate target schemas", () => {
  it("keeps move confirmation capped at 500 candidates", () => {
    expect(MovedCandidateTargetsSchema.safeParse({ candidateIds }).success).toBe(false);
  });

  it("allows bulk dismissal beyond the confirmation cap", () => {
    expect(MovedDismissTargetsSchema.safeParse({ candidateIds }).success).toBe(true);
  });
});

describe("missing file schemas", () => {
  it("accepts the dismissed filter and bulk targets", () => {
    expect(MissingFilesParamsSchema.parse({ dismissedOnly: true })).toEqual({
      dismissedOnly: true,
    });
    expect(MissingFileTargetsSchema.safeParse({ fileIds: [1, 2] }).success).toBe(true);
  });

  it("caps bulk missing-file actions at 50,000 ids", () => {
    expect(MissingFileTargetsSchema.safeParse({ fileIds }).success).toBe(false);
  });
});
