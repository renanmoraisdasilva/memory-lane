import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, DatabaseBackup, Plus, ShieldAlert } from "lucide-react";
import type { ReplicationOverview } from "@shared/contracts/replication/types";
import { Alert, Callout } from "../../components/ui/Callout";
import { EmptyState } from "../../components/ui/EmptyState";
import { formatCount } from "../../lib/format";
import { AddDestinationDrawer } from "./AddDestinationDrawer";
import { CoverageCard, DestinationCard, formatSize, Stat } from "./components";
import { useReplicationOverview } from "./use-replication";
import styles from "./replication.module.css";

function OverviewHeader({
  overview,
  onAddDestination,
}: {
  overview: ReplicationOverview;
  onAddDestination: () => void;
}): React.JSX.Element {
  return (
    <header className={styles.header}>
      <div>
        <div className={styles.eyebrow}>Backup</div>
        <h1>Backup destinations</h1>
        <p className={styles.summary}>
          {overview.source.label} is the source archive and stays read-only. Memory Lane verifies
          existing copies, fills gaps oldest-first, and keeps a full copy when you ask for one.
        </p>
      </div>
      <div className={styles.actions}>
        {overview.destinations.length === 0 ? null : (
          <Link className={styles.secondaryButton} to="/backup/plan">
            Review plan
          </Link>
        )}
        <button className={styles.primaryButton} type="button" onClick={onAddDestination}>
          <Plus size={14} aria-hidden="true" /> Add destination
        </button>
      </div>
    </header>
  );
}

function OverviewCallouts({ overview }: { overview: ReplicationOverview }): React.JSX.Element {
  const active = overview.destinations.filter(
    (destination) => destination.connection !== "retired" && destination.connection !== "lost",
  );
  const allOffline =
    active.length > 0 && active.every((destination) => destination.connection === "offline");
  const fullCopyComplete = overview.destinations.some(
    (destination) => destination.fullCopyStatus === "complete",
  );
  const extras = overview.destinations.some(
    (destination) => destination.attention.onlyOnDriveFiles > 0,
  );
  const promotable = overview.destinations.find(
    (destination) =>
      destination.goal === "full_copy" &&
      destination.fullCopyStatus === "complete" &&
      destination.connection === "connected" &&
      destination.attention.sourceMissingFiles === 0,
  );
  return (
    <>
      {allOffline ? (
        <Callout
          tone="amber"
          icon={<AlertTriangle size={15} aria-hidden="true" />}
          title="Every destination is offline"
        >
          The plan stays readable, but copying waits until at least one drive reconnects.
        </Callout>
      ) : null}
      {fullCopyComplete ? (
        <Callout
          tone="green"
          icon={<CheckCircle2 size={15} aria-hidden="true" />}
          title="A complete full copy is available"
        >
          This drive holds every present source file and can become the next source archive.{" "}
          {promotable === undefined ? null : (
            <Link to={`/backup/promote/${promotable.destinationId}`}>Review promotion</Link>
          )}
        </Callout>
      ) : null}
      {extras ? (
        <Callout
          tone="amber"
          icon={<ShieldAlert size={15} aria-hidden="true" />}
          title="Some destination files are not part of the source"
        >
          They stay visible under Only on this drive. Memory Lane never copies them into the source
          or deletes them automatically.
        </Callout>
      ) : null}
    </>
  );
}

function DestinationSection({ overview }: { overview: ReplicationOverview }): React.JSX.Element {
  return (
    <section className={styles.card}>
      <header className={styles.cardHead}>
        <div className={styles.cardTitle}>
          <div>
            <h2>Destinations</h2>
            <p>Fill order runs top to bottom. Existing files are never moved.</p>
          </div>
        </div>
      </header>
      <div className={styles.destinationList}>
        {overview.destinations.map((destination) => (
          <DestinationCard
            key={destination.destinationId}
            destination={destination}
            href={`/backup/destinations/${destination.destinationId}`}
          />
        ))}
      </div>
    </section>
  );
}

export function ReplicationOverviewPage(): React.JSX.Element {
  const overview = useReplicationOverview();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const data = overview.data;

  if (overview.isPending) {
    return (
      <div className={styles.page}>
        <p className={styles.loading}>Loading backup overview…</p>
      </div>
    );
  }
  if (overview.error !== null || data === undefined) {
    return (
      <div className={styles.page}>
        <Alert>Could not load the backup overview.</Alert>
      </div>
    );
  }

  const active = data.destinations.filter(
    (destination) => destination.connection !== "retired" && destination.connection !== "lost",
  );

  return (
    <div className={styles.page}>
      <OverviewHeader overview={data} onAddDestination={() => setDrawerOpen(true)} />
      <div className={styles.statGrid}>
        <Stat label="Source files" value={formatCount(data.source.fileCount)} />
        <Stat label="Source size" value={formatSize(data.source.bytes)} />
        <Stat
          label="Destinations"
          value={`${String(active.length)} active · ${String(data.destinations.length)} total`}
        />
      </div>
      {data.run === null ? null : (
        <Callout
          tone="amber"
          icon={<AlertTriangle size={15} aria-hidden="true" />}
          title={`Backup ${data.run.status}`}
        >
          {data.run.currentDestinationLabel === null
            ? "Open the backup run to resume or stop it."
            : `Copying to ${data.run.currentDestinationLabel}. Open the backup run to pause or stop it.`}{" "}
          <Link to="/backup/run">Open backup run</Link>
        </Callout>
      )}
      {data.destinations.length === 0 ? (
        <EmptyState
          icon={<DatabaseBackup size={22} aria-hidden="true" />}
          title="Add a backup destination"
          action={
            <button
              className={styles.primaryButton}
              type="button"
              onClick={() => setDrawerOpen(true)}
            >
              <Plus size={14} aria-hidden="true" /> Add destination
            </button>
          }
        >
          Connect a dedicated external drive. Existing Memory Lane copies are adopted and verified
          without moving or deleting anything.
        </EmptyState>
      ) : (
        <>
          <OverviewCallouts overview={data} />
          <CoverageCard coverage={data.coverage} />
          <DestinationSection overview={data} />
          <div className={styles.footer}>
            <span className={styles.muted}>
              Coverage is last-known for offline drives. Verified means a stored SHA-256 match.
            </span>
            <Link className={styles.primaryButton} to="/backup/plan">
              Review backup plan
            </Link>
          </div>
        </>
      )}
      {drawerOpen ? (
        <AddDestinationDrawer
          onClose={() => setDrawerOpen(false)}
          onRegistered={() => setDrawerOpen(false)}
        />
      ) : null}
    </div>
  );
}
