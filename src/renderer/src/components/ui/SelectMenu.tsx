import type { RefObject } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import type { MenuPosition, SelectOption } from "./select-types";
import styles from "./Select.module.css";

interface SelectMenuProps<T extends string> {
  menuRef: RefObject<HTMLDivElement | null>;
  menuId: string;
  triggerId: string;
  options: readonly SelectOption<T>[];
  value: T;
  activeIndex: number;
  position: MenuPosition;
  onHover: (index: number) => void;
  onChoose: (option: SelectOption<T>) => void;
}

export function SelectMenu<T extends string>({
  menuRef,
  menuId,
  triggerId,
  options,
  value,
  activeIndex,
  position,
  onHover,
  onChoose,
}: SelectMenuProps<T>): React.JSX.Element {
  return createPortal(
    <div
      ref={menuRef}
      id={menuId}
      className={styles.menu}
      role="listbox"
      aria-labelledby={triggerId}
      style={{
        left: position.left,
        width: position.width,
        top: position.top,
        bottom: position.bottom,
        maxHeight: position.maxHeight,
      }}
    >
      {options.map((option, index) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            className={`${styles.option}${index === activeIndex ? ` ${styles.optionActive}` : ""}`}
            type="button"
            role="option"
            aria-selected={isSelected}
            tabIndex={-1}
            onMouseEnter={() => onHover(index)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onChoose(option)}
          >
            <span className={styles.optionText}>
              <span>{option.label}</span>
              {option.description === undefined ? null : (
                <span className={styles.optionDescription}>{option.description}</span>
              )}
            </span>
            {isSelected ? <Check className={styles.check} size={14} aria-hidden="true" /> : null}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}
