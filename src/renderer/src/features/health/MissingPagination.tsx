import { formatCount } from "../../lib/format";
import styles from "./HealthPage.module.css";

export function MissingPagination({
  page,
  pageCount,
  pending,
  onPrevious,
  onNext,
}: {
  page: number;
  pageCount: number;
  pending: boolean;
  onPrevious: () => void;
  onNext: () => void;
}): React.JSX.Element | null {
  if (pageCount <= 1) {
    return null;
  }
  return (
    <div className={styles.pagination}>
      <button
        className={styles.secondaryButton}
        type="button"
        disabled={pending || page === 0}
        onClick={onPrevious}
      >
        Previous
      </button>
      <span className={styles.muted}>
        Page {formatCount(page + 1)} of {formatCount(pageCount)}
      </span>
      <button
        className={styles.secondaryButton}
        type="button"
        disabled={pending || page + 1 >= pageCount}
        onClick={onNext}
      >
        Next
      </button>
    </div>
  );
}
