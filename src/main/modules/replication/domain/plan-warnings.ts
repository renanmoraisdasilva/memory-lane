import type { PlanWarning } from "@shared/contracts/replication/types";
import {
  activeDestinations,
  bytesOf,
  type PlanDestinationInput,
  type PlanInput,
} from "./plan-types";
import type { SourceFileFacts } from "./replication-types";

function pushWarning(
  warnings: PlanWarning[],
  code: string,
  severity: PlanWarning["severity"],
  message: string,
): void {
  warnings.push({ code, severity, message });
}

function destinationWarnings(input: PlanInput, active: PlanDestinationInput[]): PlanWarning[] {
  const warnings: PlanWarning[] = [];
  if (input.destinations.length === 0) {
    pushWarning(
      warnings,
      "no_destination",
      "blocking",
      "Add a backup destination before planning a backup.",
    );
  } else if (active.length === 0) {
    pushWarning(
      warnings,
      "no_active_destination",
      "blocking",
      "Every backup destination is retired or lost. Add or reactivate one.",
    );
  } else if (active.every((destination) => destination.summary.connection === "offline")) {
    pushWarning(
      warnings,
      "all_offline",
      "blocking",
      "Connect a backup destination before starting a backup.",
    );
  }
  const unconfirmed = active.filter(
    (destination) => destination.summary.identityConfidence !== "confirmed",
  );
  if (unconfirmed.length > 0) {
    pushWarning(
      warnings,
      "identity_unconfirmed",
      "warning",
      `${String(unconfirmed.length)} destinations need identity confirmation.`,
    );
  }
  const offline = active.filter((destination) => destination.summary.connection === "offline");
  if (offline.length > 0) {
    pushWarning(
      warnings,
      "offline_destination",
      "info",
      `${offline.map((destination) => destination.summary.label).join(", ")} offline; assigned files wait for reconnect.`,
    );
  }
  return warnings;
}

function sourceWarnings(
  input: PlanInput,
  remainder: SourceFileFacts[],
  hasPartialDestination: boolean,
): PlanWarning[] {
  const warnings: PlanWarning[] = [];
  const undated = input.sourceFiles.filter((file) => file.resolvedDate === null).length;
  if (undated > 0) {
    pushWarning(
      warnings,
      "undated_files",
      "warning",
      `${String(undated)} files have no reliable date and will be planned last.`,
    );
  }
  if (input.sourceFiles.length === 0) {
    pushWarning(
      warnings,
      "empty_source",
      "blocking",
      "The source archive has no present files to back up.",
    );
  } else if (hasPartialDestination && remainder.length > 0) {
    pushWarning(
      warnings,
      "partial_remainder",
      "warning",
      `${String(remainder.length)} files do not fit the available partial destinations.`,
    );
  }
  return warnings;
}

function replicaWarnings(active: PlanDestinationInput[]): PlanWarning[] {
  const stale = active.reduce((total, destination) => total + destination.staleFiles, 0);
  const missing = active.reduce((total, destination) => total + destination.missingFiles, 0);
  const conflict = active.reduce((total, destination) => total + destination.conflictFiles, 0);
  if (stale + missing + conflict === 0) {
    return [];
  }
  return [
    {
      code: "replica_review",
      severity: "warning",
      message: `${String(stale)} stale, ${String(missing)} missing, and ${String(conflict)} conflict replicas need review.`,
    },
  ];
}

function shortfallWarnings(input: PlanInput): PlanWarning[] {
  const shortfallBytes = activeDestinations(input.destinations).reduce((total, destination) => {
    if (destination.summary.goal !== "full_copy") {
      return total;
    }
    const newBytes = bytesOf(
      input.sourceFiles.filter((file) => !destination.verifiedFileIds.has(file.id)),
    );
    return Math.max(total, newBytes - destination.summary.availableBytes);
  }, 0);
  if (shortfallBytes === 0) {
    return [];
  }
  return [
    {
      code: "full_copy_shortfall",
      severity: "warning",
      message: "The full-copy destination is short of safe space for the whole archive.",
    },
  ];
}

export function buildWarnings(input: PlanInput, remainder: SourceFileFacts[]): PlanWarning[] {
  const active = activeDestinations(input.destinations);
  const hasPartialDestination = active.some(
    (destination) => destination.summary.goal === "extend_coverage",
  );
  return [
    ...destinationWarnings(input, active),
    ...sourceWarnings(input, remainder, hasPartialDestination),
    ...replicaWarnings(active),
    ...shortfallWarnings(input),
  ];
}
