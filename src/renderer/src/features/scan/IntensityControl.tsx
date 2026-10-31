import { useId } from "react";
import { Spinner } from "../../components/ui/Callout";
import { SCAN_INTENSITY_OPTIONS, type ScanIntensity } from "./types";
import styles from "./ScanPage.module.css";

export function IntensityControl({
  value,
  pending,
  onChange,
}: {
  value: ScanIntensity;
  pending: boolean;
  onChange: (value: ScanIntensity) => void;
}): React.JSX.Element {
  const groupName = useId();

  return (
    <section className={styles.panel} aria-labelledby={`${groupName}-title`}>
      <div className={styles.panelHead}>
        <h2 id={`${groupName}-title`}>Processing intensity</h2>
        {pending ? <Spinner /> : null}
      </div>
      <p className={styles.panelDescription}>
        Controls how much background work Memory Lane schedules. Progress is always saved safely.
      </p>
      <fieldset className={styles.intensityFieldset} disabled={pending}>
        <legend className={styles.visuallyHidden}>Processing intensity</legend>
        <div className={styles.intensityGrid}>
          {SCAN_INTENSITY_OPTIONS.map((option) => (
            <label
              key={option.id}
              className={`${styles.intensityOption}${value === option.id ? ` ${styles.intensityActive}` : ""}`}
            >
              <input
                className={styles.intensityInput}
                type="radio"
                name={groupName}
                value={option.id}
                checked={value === option.id}
                onChange={() => onChange(option.id)}
              />
              <span className={styles.intensityLabel}>{option.label}</span>
              <span className={styles.intensityHint}>{option.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </section>
  );
}
