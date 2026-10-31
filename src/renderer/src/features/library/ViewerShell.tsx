import { AlertTriangle } from "lucide-react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useWorkspace } from "../../app/workspace";
import { Spinner } from "../../components/ui/Callout";
import { EmptyState } from "../../components/ui/EmptyState";
import { AppShell } from "../shell/AppShell";
import { libraryPath, parseFileId, parseLibraryDensity, parseLibraryFilter } from "./library-url";
import { LibraryErrorState } from "./LibraryErrorState";
import { MediaViewerPage } from "./MediaViewerPage";
import { useLibraryItem } from "./use-library";
import styles from "./MediaViewer.module.css";

export function ViewerShell(): React.JSX.Element {
  const { drive, catalog, closeWorkspace } = useWorkspace();
  const { fileId: fileIdParam } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const filter = parseLibraryFilter(searchParams.get("filter"));
  const density = parseLibraryDensity(searchParams.get("density"));
  const fileId = parseFileId(fileIdParam);
  const query = useLibraryItem(fileId, filter);

  if (drive === null || catalog === null) {
    return <Navigate to="/" replace />;
  }

  const crumbs =
    query.data === undefined
      ? ["Library", "Memory Lane", "Media viewer"]
      : ["Library", "Memory Lane", query.data.item.name];

  function switchDrive(): void {
    closeWorkspace();
    void navigate("/");
  }

  if (fileId === null) {
    return (
      <AppShell mode="fill" crumbs={crumbs}>
        <div className={styles.shellState}>
          <EmptyState
            icon={<AlertTriangle size={26} aria-hidden="true" />}
            title="Media item not found"
            action={
              <Link className={styles.secondaryButton} to={libraryPath(filter, density)}>
                Back to Memory Lane
              </Link>
            }
          >
            This link does not contain a valid file id.
          </EmptyState>
        </div>
      </AppShell>
    );
  }

  if (query.isLoading) {
    return (
      <AppShell mode="fill" crumbs={crumbs}>
        <div className={styles.shellState} role="status">
          <Spinner />
          Loading media…
        </div>
      </AppShell>
    );
  }

  if (query.isError || query.data === undefined) {
    return (
      <AppShell mode="fill" crumbs={crumbs}>
        <div className={styles.shellState}>
          <LibraryErrorState
            error={query.error}
            onRetry={() => void query.refetch()}
            onSwitchDrive={switchDrive}
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell mode="fill" crumbs={crumbs}>
      <MediaViewerPage
        key={query.data.item.fileId}
        details={query.data}
        filter={filter}
        density={density}
      />
    </AppShell>
  );
}
