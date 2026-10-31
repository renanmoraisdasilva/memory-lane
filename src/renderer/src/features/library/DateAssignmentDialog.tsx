import { useState } from "react";
import { Alert, Spinner } from "../../components/ui/Callout";
import { Modal } from "../../components/ui/Modal";
import { DateAssignmentFields } from "./DateAssignmentFields";
import styles from "./UndatedPage.module.css";

function errorMessage(error: unknown): string | null {
  if (error === null || error === undefined) {
    return null;
  }
  return error instanceof Error ? error.message : "The catalog date could not be updated.";
}

export function DateAssignmentDialog({
  initialYear,
  initialMonth,
  pending,
  error,
  onClose,
  onApply,
}: {
  initialYear: number | null;
  initialMonth: number | null;
  pending: boolean;
  error: unknown;
  onClose: () => void;
  onApply: (year: number, month: number | null) => void;
}): React.JSX.Element {
  const [year, setYear] = useState<number | null>(initialYear);
  const [month, setMonth] = useState<number | null>(initialMonth);

  const message = errorMessage(error);
  const canApply = year !== null && year >= 1800 && year <= 2200 && !pending;

  return (
    <Modal
      title="Set catalog date"
      description="Choose a year, and optionally a month. This changes the catalog only."
      onClose={onClose}
      dismissible={!pending}
      footer={
        <>
          <button
            className={styles.secondaryButton}
            type="button"
            disabled={pending}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className={styles.primaryButton}
            type="button"
            disabled={!canApply}
            onClick={() => {
              if (year !== null) {
                onApply(year, month);
              }
            }}
          >
            {pending ? <Spinner /> : null}
            {pending ? "Saving…" : "Apply to catalog"}
          </button>
        </>
      }
    >
      <DateAssignmentFields
        year={year}
        month={month}
        disabled={pending}
        onYearChange={setYear}
        onMonthChange={setMonth}
      />
      {message === null ? null : <Alert>{message}</Alert>}
    </Modal>
  );
}
