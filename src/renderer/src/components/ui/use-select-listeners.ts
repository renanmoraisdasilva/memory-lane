import { useEffect, type RefObject } from "react";
import type { MenuPosition, SelectOption } from "./select-types";
import { beginSelectMenu } from "./select-menu-state";

interface SelectAction {
  type: "close" | "move" | "choose";
  index?: number;
}

function selectAction(
  event: KeyboardEvent,
  activeIndex: number,
  optionCount: number,
): SelectAction | null {
  if (event.key === "Escape" || event.key === "Tab") {
    return { type: "close" };
  }
  if (event.key === "ArrowDown") {
    return { type: "move", index: (activeIndex + 1) % optionCount };
  }
  if (event.key === "ArrowUp") {
    return { type: "move", index: (activeIndex - 1 + optionCount) % optionCount };
  }
  if (event.key === "Home") {
    return { type: "move", index: 0 };
  }
  if (event.key === "End") {
    return { type: "move", index: optionCount - 1 };
  }
  if (event.key === "Enter" || event.key === " ") {
    return { type: "choose", index: activeIndex };
  }
  return null;
}

interface ApplySelectActionInput<T extends string> {
  action: SelectAction;
  options: readonly SelectOption<T>[];
  activeIndex: number;
  onChange: (value: T) => void;
  setOpen: (open: boolean) => void;
  setActiveIndex: (index: number) => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
}

function applySelectAction<T extends string>({
  action,
  options,
  activeIndex,
  onChange,
  setOpen,
  setActiveIndex,
  triggerRef,
}: ApplySelectActionInput<T>): void {
  if (action.type === "close") {
    setOpen(false);
    triggerRef.current?.focus();
    return;
  }
  if (action.type === "move") {
    setActiveIndex(action.index ?? activeIndex);
    return;
  }
  const option = action.index === undefined ? undefined : options[action.index];
  if (option !== undefined) {
    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  }
}

interface UseSelectListenersInput<T extends string> {
  open: boolean;
  activeIndex: number;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  menuRef: RefObject<HTMLDivElement | null>;
  setOpen: (open: boolean) => void;
  setActiveIndex: (index: number) => void;
  setPosition: (position: MenuPosition) => void;
  menuPosition: (trigger: HTMLElement, optionCount: number) => MenuPosition;
}

export function useSelectListeners<T extends string>({
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
}: UseSelectListenersInput<T>): void {
  useEffect(() => {
    if (!open) {
      return;
    }
    const releaseMenu = beginSelectMenu();
    function updatePosition(): void {
      if (triggerRef.current !== null) {
        setPosition(menuPosition(triggerRef.current, options.length));
      }
    }
    function handlePointerDown(event: PointerEvent): void {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (
        triggerRef.current?.contains(target) === true ||
        menuRef.current?.contains(target) === true
      ) {
        return;
      }
      setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent): void {
      const action = selectAction(event, activeIndex, options.length);
      if (action === null) {
        return;
      }
      if (action.type === "close" && event.key === "Tab") {
        setOpen(false);
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      applySelectAction({
        action,
        options,
        activeIndex,
        onChange,
        setOpen,
        setActiveIndex,
        triggerRef,
      });
    }
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      releaseMenu();
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [
    activeIndex,
    menuPosition,
    menuRef,
    onChange,
    open,
    options,
    setActiveIndex,
    setOpen,
    setPosition,
    triggerRef,
  ]);
}
