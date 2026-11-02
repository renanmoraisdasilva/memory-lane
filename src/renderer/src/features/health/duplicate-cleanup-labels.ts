import type {
  DuplicateCleanupSkipCounts,
  DuplicateCleanupSummary,
  DuplicateGroup,
} from "@shared/contracts/health";
import { formatCount } from "../../lib/format";

const SKIP_LABELS: Record<keyof DuplicateCleanupSkipCounts, string> = {
  notAGroup: "not a group",
  empty: "empty files",
  belowMinimumSize: "files under 1 KB",
  keeperNotCovered: "keeper has no verified backup",
  candidateDateOverride: "date override on a copy that would move",
  multipleDateOverrides: "multiple date overrides",
  hardLink: "hard-linked copies",
};

export function skipReasonLabel(reason: DuplicateGroup["skipReason"]): string {
  switch (reason) {
    case "not-a-group":
      return SKIP_LABELS.notAGroup;
    case "empty":
      return SKIP_LABELS.empty;
    case "below-minimum-size":
      return SKIP_LABELS.belowMinimumSize;
    case "keeper-not-covered":
      return SKIP_LABELS.keeperNotCovered;
    case "candidate-date-override":
      return SKIP_LABELS.candidateDateOverride;
    case "multiple-date-overrides":
      return SKIP_LABELS.multipleDateOverrides;
    case "hard-link":
      return SKIP_LABELS.hardLink;
    case null:
      return "not eligible";
  }
}

export function skippedSummary(summary: DuplicateCleanupSummary): string {
  const parts: string[] = [];
  for (const key of Object.keys(SKIP_LABELS) as Array<keyof DuplicateCleanupSkipCounts>) {
    const count = summary.skipCounts[key];
    if (count > 0) {
      parts.push(`${formatCount(count)} ${SKIP_LABELS[key]}`);
    }
  }
  return parts.length === 0 ? "none" : parts.join(" · ");
}
