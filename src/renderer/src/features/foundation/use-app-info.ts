import { useQuery } from "@tanstack/react-query";
import { usePhaseOneClient } from "../../lib/client-context";
import { queryKeys } from "../../lib/query-keys";

export function useAppInfo() {
  const client = usePhaseOneClient();
  return useQuery({
    queryKey: queryKeys.appInfo,
    queryFn: () => client.getAppInfo(),
    staleTime: 30_000,
  });
}
