import { ChangedLetterDialog } from "./ChangedLetterDialog";
import { SetupCatalogDialog } from "./SetupCatalogDialog";
import type { DriveSelectionItem } from "./types";

export function DriveDialogs({
  setupDrive,
  letterDrive,
  setupPending,
  letterPending,
  setupError,
  letterError,
  onCloseSetup,
  onCloseLetter,
  onConfirmSetup,
  onConfirmLetter,
}: {
  setupDrive: DriveSelectionItem | null;
  letterDrive: DriveSelectionItem | null;
  setupPending: boolean;
  letterPending: boolean;
  setupError: string | null;
  letterError: string | null;
  onCloseSetup: () => void;
  onCloseLetter: () => void;
  onConfirmSetup: () => void;
  onConfirmLetter: () => void;
}): React.JSX.Element {
  return (
    <>
      {setupDrive === null ? null : (
        <SetupCatalogDialog
          drive={setupDrive}
          pending={setupPending}
          error={setupError}
          onClose={onCloseSetup}
          onConfirm={onConfirmSetup}
        />
      )}
      {letterDrive === null ? null : (
        <ChangedLetterDialog
          drive={letterDrive}
          pending={letterPending}
          error={letterError}
          onClose={onCloseLetter}
          onConfirm={onConfirmLetter}
        />
      )}
    </>
  );
}
