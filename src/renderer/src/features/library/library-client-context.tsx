import { createContext, useContext, type ReactNode } from "react";
import type { LibraryClient } from "./library-client";

const LibraryClientContext = createContext<LibraryClient | null>(null);

export function LibraryClientProvider({
  client,
  children,
}: {
  client: LibraryClient;
  children: ReactNode;
}): React.JSX.Element {
  return <LibraryClientContext.Provider value={client}>{children}</LibraryClientContext.Provider>;
}

export function useLibraryClient(): LibraryClient {
  const client = useContext(LibraryClientContext);
  if (client === null) {
    throw new Error("useLibraryClient must be used inside LibraryClientProvider");
  }
  return client;
}
