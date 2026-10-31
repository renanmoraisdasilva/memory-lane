import styles from "./DateAssignment.module.css";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export interface DateAssignmentFieldsProps {
  year: number | null;
  month: number | null;
  disabled?: boolean;
  onYearChange: (year: number | null) => void;
  onMonthChange: (month: number | null) => void;
}

export function dateAssignmentPreview(year: number | null, month: number | null): string {
  if (year === null) {
    return "Choose a year";
  }
  if (month === null) {
    return String(year);
  }
  return `${MONTHS[month - 1] ?? "Unknown month"} ${String(year)}`;
}

export function DateAssignmentFields({
  year,
  month,
  disabled = false,
  onYearChange,
  onMonthChange,
}: DateAssignmentFieldsProps): React.JSX.Element {
  return (
    <div className={styles.fields}>
      <label className={styles.field}>
        <span>Year</span>
        <input
          type="number"
          min={1800}
          max={2200}
          value={year ?? ""}
          disabled={disabled}
          placeholder="e.g. 2011"
          onChange={(event) => {
            const value = event.target.value;
            onYearChange(value.length === 0 ? null : Number(value));
          }}
        />
      </label>
      <label className={styles.field}>
        <span>Month</span>
        <select
          value={month ?? ""}
          disabled={disabled || year === null}
          onChange={(event) => {
            const value = event.target.value;
            onMonthChange(value.length === 0 ? null : Number(value));
          }}
        >
          <option value="">Not specified</option>
          {MONTHS.map((name, index) => (
            <option key={name} value={index + 1}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <p className={styles.preview} role="status">
        Catalog date: <strong>{dateAssignmentPreview(year, month)}</strong>
      </p>
      <p className={styles.note}>
        Precision stays honest: a year-only assignment is not expanded to a day. Original files and
        metadata are untouched.
      </p>
    </div>
  );
}
