import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import styles from "./ui.module.css";
import { isSelectMenuOpen } from "./select-menu-state";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface ModalProps {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  drawer?: boolean;
  dismissible?: boolean;
}

function trapTab(event: KeyboardEvent, dialog: HTMLDivElement | null): void {
  if (event.key !== "Tab" || dialog === null) {
    return;
  }
  const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
  const first = items[0];
  const last = items[items.length - 1];
  if (first === undefined || last === undefined) {
    event.preventDefault();
    return;
  }
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export function Modal({
  title,
  description,
  onClose,
  children,
  footer,
  wide = false,
  drawer = false,
  dismissible = true,
}: ModalProps): React.JSX.Element {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement;
    closeRef.current?.focus();
    return () => {
      if (previous instanceof HTMLElement && document.contains(previous)) {
        previous.focus();
      }
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape" && dismissible && !isSelectMenuOpen()) {
        event.preventDefault();
        onClose();
        return;
      }
      trapTab(event, dialogRef.current);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [dismissible, onClose]);

  const dialogClass = drawer
    ? styles.drawer
    : `${styles.modal}${wide ? ` ${styles.modalWide}` : ""}`;
  const backdropClass = drawer ? `${styles.backdrop} ${styles.backdropDrawer}` : styles.backdrop;

  return createPortal(
    <div className={backdropClass}>
      <div
        ref={dialogRef}
        className={dialogClass}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className={styles.modalHead}>
          <div>
            <h2 id={titleId}>{title}</h2>
            {description === undefined ? null : <p>{description}</p>}
          </div>
          {dismissible ? (
            <button
              ref={closeRef}
              className={styles.modalClose}
              type="button"
              aria-label="Close dialog"
              onClick={onClose}
            >
              <X size={16} aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <div className={styles.modalBody}>{children}</div>
        {footer === undefined ? null : <div className={styles.modalFooter}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
