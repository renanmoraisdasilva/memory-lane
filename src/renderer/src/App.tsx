import { NavLink, Route, Routes } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { FoundationPage } from "./features/foundation/FoundationPage";
import styles from "./App.module.css";

export function App(): React.JSX.Element {
  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <NavLink to="/" className={styles.brand ?? ""}>
          <span className={styles.mark} aria-hidden="true">
            ML
          </span>
          <span>
            <span className={styles.name}>Memory Lane</span>
            <span className={styles.subtitle}>Local archive foundation</span>
          </span>
        </NavLink>
        <span className={styles.readonly}>
          <ShieldCheck size={14} aria-hidden="true" />
          Read-only archive
        </span>
      </header>

      <main className={styles.main}>
        <Routes>
          <Route path="*" element={<FoundationPage />} />
        </Routes>
      </main>

      <footer className={styles.footer}>
        <span>Phase 0 · catalog ready for the scan pipeline</span>
        <span>Local only · no telemetry</span>
      </footer>
    </div>
  );
}
