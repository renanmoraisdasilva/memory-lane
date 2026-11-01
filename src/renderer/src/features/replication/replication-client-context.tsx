import { createContext, useContext, type ReactNode } from "react";
import type { ReplicationClient } from "./replication-client";

const ReplicationClientContext = createContext<ReplicationClient | null>(null);

export function ReplicationClientProvider({
  client,
  children,
}: {
  client: ReplicationClient;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <ReplicationClientContext.Provider value={client}>{children}</ReplicationClientContext.Provider>
  );
}

export function useReplicationClient(): ReplicationClient {
  const client = useContext(ReplicationClientContext);
  if (client === null) {
    throw new Error("useReplicationClient must be used inside ReplicationClientProvider");
  }
  return client;
}
