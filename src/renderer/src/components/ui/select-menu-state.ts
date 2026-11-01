let openMenus = 0;

export function beginSelectMenu(): () => void {
  openMenus += 1;
  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    openMenus = Math.max(0, openMenus - 1);
  };
}

export function isSelectMenuOpen(): boolean {
  return openMenus > 0;
}
