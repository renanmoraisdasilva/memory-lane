import { useId } from "react";
import { ChevronDown } from "lucide-react";
import { SelectMenu } from "./SelectMenu";
import type { SelectOption } from "./select-types";
import { useSelectController } from "./use-select-controller";
import styles from "./Select.module.css";

export interface SelectProps<T extends string> {
  id?: string;
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  describedBy?: string;
}

export function Select<T extends string>({
  id,
  value,
  options,
  onChange,
  disabled = false,
  describedBy,
}: SelectProps<T>): React.JSX.Element {
  const generatedId = useId();
  const triggerId = id ?? `select-${generatedId}`;
  const menuId = `${triggerId}-menu`;
  const controller = useSelectController({ value, options, disabled, onChange });
  const {
    triggerRef,
    menuRef,
    open,
    activeIndex,
    position,
    setActiveIndex,
    toggle,
    choose,
    handleTriggerKeyDown,
  } = controller;
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const selected = options[selectedIndex];

  return (
    <>
      <button
        ref={triggerRef}
        id={triggerId}
        className={styles.trigger}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={toggle}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className={styles.value}>{selected?.label ?? ""}</span>
        <ChevronDown className={styles.chevron} size={14} aria-hidden="true" />
      </button>
      {open && position !== null ? (
        <SelectMenu
          menuRef={menuRef}
          menuId={menuId}
          triggerId={triggerId}
          options={options}
          value={value}
          activeIndex={activeIndex}
          position={position}
          onHover={setActiveIndex}
          onChoose={choose}
        />
      ) : null}
    </>
  );
}
