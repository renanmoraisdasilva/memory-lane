import { useRef, useState, type RefObject } from "react";
import type { MenuPosition, SelectOption } from "./select-types";
import { useSelectListeners } from "./use-select-listeners";

interface UseSelectControllerInput<T extends string> {
  value: T;
  options: readonly SelectOption<T>[];
  disabled: boolean;
  onChange: (value: T) => void;
}

export interface SelectController<T extends string> {
  triggerRef: RefObject<HTMLButtonElement | null>;
  menuRef: RefObject<HTMLDivElement | null>;
  open: boolean;
  activeIndex: number;
  position: MenuPosition | null;
  setActiveIndex: (index: number) => void;
  toggle: () => void;
  choose: (option: SelectOption<T>) => void;
  handleTriggerKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
}

function menuPosition(trigger: HTMLElement, optionCount: number): MenuPosition {
  const rect = trigger.getBoundingClientRect();
  const estimatedHeight = Math.min(240, optionCount * 54 + 8);
  const spaceBelow = window.innerHeight - rect.bottom;
  const openAbove = spaceBelow < estimatedHeight && rect.top > spaceBelow;
  return {
    left: rect.left,
    width: rect.width,
    ...(openAbove
      ? { bottom: window.innerHeight - rect.top + 4, maxHeight: Math.max(80, rect.top - 8) }
      : { top: rect.bottom + 4, maxHeight: Math.max(80, spaceBelow - 8) }),
  };
}

export function useSelectController<T extends string>({
  value,
  options,
  disabled,
  onChange,
}: UseSelectControllerInput<T>): SelectController<T> {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState<MenuPosition | null>(null);

  function toggle(): void {
    if (disabled) {
      return;
    }
    if (open) {
      setOpen(false);
      return;
    }
    if (triggerRef.current !== null) {
      setPosition(menuPosition(triggerRef.current, options.length));
    }
    const selectedIndex = options.findIndex((option) => option.value === value);
    setActiveIndex(Math.max(0, selectedIndex));
    setOpen(true);
  }

  function choose(option: SelectOption<T>): void {
    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>): void {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }
    event.preventDefault();
    if (!open) {
      toggle();
    }
  }

  useSelectListeners({
    open,
    activeIndex,
    options,
    onChange,
    triggerRef,
    menuRef,
    setOpen,
    setActiveIndex,
    setPosition,
    menuPosition,
  });

  return {
    triggerRef,
    menuRef,
    open,
    activeIndex,
    position,
    setActiveIndex,
    toggle,
    choose,
    handleTriggerKeyDown,
  };
}
