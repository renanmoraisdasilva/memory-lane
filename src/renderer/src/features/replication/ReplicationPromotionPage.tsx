import { useState } from "react";
import { flushSync } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import type { VolumeId } from "@shared/contracts/drives";
import type { PromotionState } from "@shared/contracts/replication/types";
import { Alert } from "../../components/ui/Callout";
import { Pill } from "../../components/ui/Pill";
import { usePhaseOneClient } from "../../lib/client-context";
import { queryKeys } from "../../lib/query-keys";
import { useWorkspace } from "../../app/workspace";
import { toDriveSelectionItem } from "../drives/types";
import { PromotionResultCard } from "./promotion-steps";
import { PromotionWizard } from "./promotion-wizard";
import { usePromotion, usePromotionRollback } from "./use-replication";
import styles from "./replication.module.css";

type RollbackControl = ReturnType<typeof usePromotionRollback>;

function statusTone(status: PromotionState["status"]): "green" | "amber" | "blue" {
  if (status === "completed") return "green";
  if (status === "rolled_back") return "amber";
  return "blue";
}

function PromotionScreen({
  state,
  destinationId,
  rollback,
  openDrive,
  onResult,
}: {
  state: PromotionState;
  destinationId: string;
  rollback: RollbackControl;
  openDrive: (volumeId: VolumeId) => void;
  onResult: (state: PromotionState) => void;
}): React.JSX.Element {
  const finished = state.status === "completed" || state.status === "rolled_back";
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <Link className={styles.ghostButton} to={`/backup/destinations/${destinationId}`}>
            <ArrowLeft size={14} aria-hidden="true" /> Destination
          </Link>
          <h1>Promote {state.destinationLabel}</h1>
          <p className={styles.summary}>
            Make the verified full copy the active source. Archive files and their dates stay in
            place.
          </p>
        </div>
        <Pill tone={statusTone(state.status)}>{state.status.replaceAll("_", " ")}</Pill>
      </header>
      {finished ? (
        <PromotionResultCard
          state={state}
          rollback={rollback}
          onOpenNew={() => {
            if (state.newCatalog !== null) openDrive(state.newCatalog.volumeId);
          }}
          onOpenPrevious={() => {
            if (state.previousSourceVolumeId !== null) {
              openDrive(state.previousSourceVolumeId);
            }
          }}
          onRollback={() => {
            if (state.promotionId === null) return;
            void rollback
              .mutateAsync({ promotionId: state.promotionId, destinationId })
              .then(onResult)
              .catch(() => undefined);
          }}
        />
      ) : (
        <PromotionWizard state={state} destinationId={destinationId} onApplied={onResult} />
      )}
    </div>
  );
}

export function ReplicationPromotionPage(): React.JSX.Element {
  const { destinationId = "" } = useParams();
  const promotion = usePromotion(destinationId);
  const rollback = usePromotionRollback();
  const client = usePhaseOneClient();
  const { openWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [result, setResult] = useState<PromotionState | null>(null);
  const state = result ?? promotion.data ?? null;

  async function openDrive(volumeId: VolumeId): Promise<void> {
    const drives = await client.listDrives();
    const drive = drives.find((candidate) => candidate.volumeId === volumeId);
    if (drive === undefined) {
      throw new Error("The drive is not connected.");
    }
    const catalog = await client.openCatalog(volumeId);
    queryClient.removeQueries({ queryKey: ["library"] });
    queryClient.removeQueries({ queryKey: ["health"] });
    queryClient.removeQueries({ queryKey: ["other-files"] });
    queryClient.removeQueries({ queryKey: queryKeys.cleanupSummary });
    flushSync(() => openWorkspace(toDriveSelectionItem(drive), catalog));
    void navigate("/library");
  }

  if (result === null && promotion.isPending) {
    return (
      <div className={styles.page}>
        <p className={styles.loading}>Loading promotion…</p>
      </div>
    );
  }
  if (state === null) {
    return (
      <div className={styles.page}>
        <Alert>{promotion.error?.message ?? "Promotion is unavailable."}</Alert>
        <Link className={styles.secondaryButton} to="/backup">
          Back to backup
        </Link>
      </div>
    );
  }
  return (
    <PromotionScreen
      state={state}
      destinationId={destinationId}
      rollback={rollback}
      openDrive={(volumeId) => void openDrive(volumeId)}
      onResult={setResult}
    />
  );
}
