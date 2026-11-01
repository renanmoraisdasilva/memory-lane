import { useState } from "react";
import { HardDrive, ShieldAlert } from "lucide-react";
import type {
  DestinationCandidate,
  DestinationDetail,
  DestinationGoal,
  RegisterDestinationParams,
} from "@shared/contracts/replication/types";
import { Alert } from "../../components/ui/Callout";
import { Modal } from "../../components/ui/Modal";
import { Pill } from "../../components/ui/Pill";
import { Select } from "../../components/ui/Select";
import { formatSize } from "./components";
import { useDestinationCandidates, useRegisterDestination } from "./use-replication";
import { useReplicationClient } from "./replication-client-context";
import styles from "./replication.module.css";

const GIB = 1024 ** 3;

interface FormState {
  goal: DestinationGoal;
  layout: "dedicated" | "mirror_source";
  allocationMode: "all_safe" | "percent" | "fixed";
  allocationPercent: string;
  allocationGb: string;
  reserveGb: string;
}

const DEFAULT_FORM: FormState = {
  goal: "extend_coverage",
  layout: "dedicated",
  allocationMode: "all_safe",
  allocationPercent: "80",
  allocationGb: "",
  reserveGb: "5",
};

function defaultReserveGb(candidate: DestinationCandidate): number {
  return Math.max(5, Math.ceil((candidate.totalBytes * 0.02) / GIB));
}

function CandidateRow({
  candidate,
  selected,
  onSelect,
}: {
  candidate: DestinationCandidate;
  selected: boolean;
  onSelect: () => void;
}): React.JSX.Element {
  return (
    <button
      className={`${styles.candidate}${selected ? ` ${styles.candidateActive}` : ""}`}
      type="button"
      onClick={onSelect}
    >
      <span>
        <strong>
          {candidate.label}
          {candidate.letter === null ? "" : ` (${candidate.letter})`}
        </strong>
        <span>
          {formatSize(candidate.freeBytes)} free of {formatSize(candidate.totalBytes)} ·{" "}
          {candidate.fileSystem}
        </span>
      </span>
      <span className={styles.badges}>
        {candidate.hasMarker ? <Pill tone="blue">Memory Lane</Pill> : null}
        {candidate.isActiveSource ? <Pill tone="red">Source</Pill> : null}
      </span>
    </button>
  );
}

function CandidatePicker({
  candidates,
  selected,
  onSelect,
}: {
  candidates: DestinationCandidate[];
  selected: DestinationCandidate | null;
  onSelect: (candidate: DestinationCandidate) => void;
}): React.JSX.Element {
  return (
    <div className={styles.card}>
      <header className={styles.cardHead}>
        <div className={styles.cardTitle}>
          <span className={styles.icon}>
            <HardDrive size={16} aria-hidden="true" />
          </span>
          <div>
            <h2>Connected drives</h2>
            <p>The source archive drive is never offered as a destination.</p>
          </div>
        </div>
      </header>
      {candidates.length === 0 ? (
        <p className={styles.muted}>
          <ShieldAlert size={13} aria-hidden="true" /> No eligible external drive is connected.
          Connect a dedicated drive and reopen this drawer.
        </p>
      ) : (
        <div className={styles.candidateList}>
          {candidates.map((candidate) => (
            <CandidateRow
              key={candidate.volumeId}
              candidate={candidate}
              selected={selected?.volumeId === candidate.volumeId}
              onSelect={() => onSelect(candidate)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type FieldUpdate = <K extends keyof FormState>(key: K, value: FormState[K]) => void;

function AllocationInputs({
  form,
  update,
}: {
  form: FormState;
  update: FieldUpdate;
}): React.JSX.Element {
  return (
    <>
      {form.allocationMode === "percent" ? (
        <div className={styles.field}>
          <label htmlFor="destination-percent">Allocation percent</label>
          <input
            id="destination-percent"
            type="number"
            min="0"
            max="100"
            value={form.allocationPercent}
            onChange={(event) => update("allocationPercent", event.target.value)}
          />
        </div>
      ) : null}
      {form.allocationMode === "fixed" ? (
        <div className={styles.field}>
          <label htmlFor="destination-fixed">Allocation (GB)</label>
          <input
            id="destination-fixed"
            type="number"
            min="0"
            value={form.allocationGb}
            onChange={(event) => update("allocationGb", event.target.value)}
          />
        </div>
      ) : null}
      <div className={styles.field}>
        <label htmlFor="destination-reserve">Safety reserve (GB)</label>
        <input
          id="destination-reserve"
          type="number"
          min="0"
          value={form.reserveGb}
          onChange={(event) => update("reserveGb", event.target.value)}
        />
        <span className={styles.fieldHint}>
          Kept free for the drive and its own files. Defaults to 2% with a 5 GB minimum.
        </span>
      </div>
    </>
  );
}

function DestinationFields({
  form,
  onChange,
}: {
  form: FormState;
  onChange: (form: FormState) => void;
}): React.JSX.Element {
  function update<K extends keyof FormState>(key: K, value: FormState[K]): void {
    onChange({ ...form, [key]: value });
  }

  return (
    <div className={`${styles.fieldGrid} ${styles.fieldGridStacked}`}>
      <div className={styles.field}>
        <label htmlFor="destination-goal">Goal</label>
        <Select
          id="destination-goal"
          value={form.goal}
          describedBy="destination-goal-hint"
          onChange={(value) => update("goal", value)}
          options={[
            {
              value: "extend_coverage",
              label: "Partial coverage",
              description: "Fill gaps oldest first",
            },
            { value: "full_copy", label: "Full copy", description: "Every source file" },
          ]}
        />
        <span className={styles.fieldHint} id="destination-goal-hint">
          A full copy can later become the source archive. Partial drives share the gap fill.
        </span>
      </div>
      <div className={styles.field}>
        <label htmlFor="destination-layout">New copy location</label>
        <Select
          id="destination-layout"
          value={form.layout}
          describedBy="destination-layout-hint"
          onChange={(value) => update("layout", value)}
          options={[
            { value: "dedicated", label: "Dedicated Memory Lane folder" },
            { value: "mirror_source", label: "Mirror source layout" },
          ]}
        />
        <span className={styles.fieldHint} id="destination-layout-hint">
          Existing files stay exactly where they are.
        </span>
      </div>
      <div className={styles.field}>
        <label htmlFor="destination-allocation">Space allocation</label>
        <Select
          id="destination-allocation"
          value={form.allocationMode}
          onChange={(value) => update("allocationMode", value)}
          options={[
            { value: "all_safe", label: "Use all safe space" },
            { value: "percent", label: "Percentage of the drive" },
            { value: "fixed", label: "Fixed size" },
          ]}
        />
      </div>
      <AllocationInputs form={form} update={update} />
    </div>
  );
}

function registerParams(
  candidate: DestinationCandidate,
  form: FormState,
): RegisterDestinationParams {
  return {
    volumeId: candidate.volumeId,
    rootRelative: "",
    goal: form.goal,
    layout: form.layout,
    allocationMode: form.allocationMode,
    allocationPercent: form.allocationMode === "percent" ? Number(form.allocationPercent) : null,
    allocationBytes:
      form.allocationMode === "fixed" ? Math.round(Number(form.allocationGb) * GIB) : null,
    reserveBytes: Math.max(0, Math.round(Number(form.reserveGb) * GIB)),
  };
}

export function AddDestinationDrawer({
  onClose,
  onRegistered,
}: {
  onClose: () => void;
  onRegistered: (destination: DestinationDetail) => void;
}): React.JSX.Element {
  const client = useReplicationClient();
  const candidates = useDestinationCandidates(true);
  const register = useRegisterDestination();
  const [selected, setSelected] = useState<DestinationCandidate | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [error, setError] = useState<string | null>(null);
  const available = (candidates.data ?? []).filter((candidate) => candidate.blockedReason === null);
  const busy = register.isPending;

  function selectCandidate(candidate: DestinationCandidate): void {
    setSelected(candidate);
    setForm({ ...form, reserveGb: String(defaultReserveGb(candidate)) });
  }

  async function submit(): Promise<void> {
    if (selected === null) {
      return;
    }
    setError(null);
    try {
      const destination = await register.mutateAsync(registerParams(selected, form));
      await client.startAdoption(destination.destinationId).catch(() => undefined);
      onRegistered(destination);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The destination could not be added.");
    }
  }

  return (
    <Modal
      drawer
      title="Add a backup destination"
      description="Choose a dedicated external drive. Its existing Memory Lane files are adopted without being moved."
      onClose={onClose}
      dismissible={!busy}
      footer={
        <>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            className={styles.primaryButton}
            type="button"
            disabled={selected === null || busy}
            onClick={() => void submit()}
          >
            {busy ? "Adding…" : "Add and adopt"}
          </button>
        </>
      }
    >
      {candidates.isPending ? <p className={styles.loading}>Looking for drives…</p> : null}
      {candidates.error ? <Alert>Could not list drives.</Alert> : null}
      <CandidatePicker candidates={available} selected={selected} onSelect={selectCandidate} />
      <div className={styles.divider} />
      <DestinationFields form={form} onChange={setForm} />
      {error === null ? null : <Alert>{error}</Alert>}
    </Modal>
  );
}
