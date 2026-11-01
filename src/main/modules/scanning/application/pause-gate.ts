export interface PauseGate {
  promise: Promise<void>;
  resolve: () => void;
}

export function createPauseGate(): PauseGate {
  let resolveGate: (() => void) | null = null;
  const promise = new Promise<void>((resolve) => {
    resolveGate = resolve;
  });
  return {
    promise,
    resolve: () => resolveGate?.(),
  };
}

export function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
