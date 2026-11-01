import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";

export type WorkloadKind = "scan" | "validation" | "replication";

export interface WorkloadLease {
  readonly kind: WorkloadKind;
  readonly ownerId: string;
  readonly startedAt: string;
  release(): void;
}

interface ActiveWorkload {
  kind: WorkloadKind;
  ownerId: string;
  startedAt: string;
}

function labelFor(kind: WorkloadKind): string {
  return kind === "scan" ? "scan" : kind === "validation" ? "validation" : "backup";
}

export class WorkloadCoordinator {
  private active: ActiveWorkload | null = null;

  constructor(private readonly now: () => Date = () => new Date()) {}

  acquire(kind: WorkloadKind, ownerId: string): WorkloadLease {
    if (this.active !== null) {
      throw new AppError(
        APP_ERROR_CODES.WORKLOAD_CONFLICT,
        `A ${labelFor(this.active.kind)} is already running. Finish or stop it first.`,
        {
          activeKind: this.active.kind,
          activeOwnerId: this.active.ownerId,
          requestedKind: kind,
          requestedOwnerId: ownerId,
        },
      );
    }

    const active: ActiveWorkload = {
      kind,
      ownerId,
      startedAt: this.now().toISOString(),
    };
    this.active = active;

    let released = false;
    return {
      kind,
      ownerId,
      startedAt: active.startedAt,
      release: () => {
        if (released) {
          return;
        }
        released = true;
        if (this.active === active) {
          this.active = null;
        }
      },
    };
  }

  current(): Readonly<ActiveWorkload> | null {
    return this.active;
  }

  isActive(kind?: WorkloadKind): boolean {
    return this.active !== null && (kind === undefined || this.active.kind === kind);
  }

  assertCanStart(kind: WorkloadKind, ownerId: string): void {
    if (this.active !== null) {
      throw new AppError(
        APP_ERROR_CODES.WORKLOAD_CONFLICT,
        `A ${labelFor(this.active.kind)} is already running. Finish or stop it first.`,
        {
          activeKind: this.active.kind,
          activeOwnerId: this.active.ownerId,
          requestedKind: kind,
          requestedOwnerId: ownerId,
        },
      );
    }
  }
}
