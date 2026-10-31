import { createContext, useContext, type ReactNode } from "react";
import type { PhaseOneClient } from "./phase-one-client";

const PhaseOneClientContext = createContext<PhaseOneClient | null>(null);

export function PhaseOneClientProvider({
  client,
  children,
}: {
  client: PhaseOneClient;
  children: ReactNode;
}): React.JSX.Element {
  return <PhaseOneClientContext.Provider value={client}>{children}</PhaseOneClientContext.Provider>;
}

export function usePhaseOneClient(): PhaseOneClient {
  const client = useContext(PhaseOneClientContext);
  if (client === null) {
    throw new Error("usePhaseOneClient must be used inside PhaseOneClientProvider");
  }
  return client;
}
