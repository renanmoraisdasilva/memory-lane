import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { VolumeId } from "@shared/contracts/drives";
import { usePhaseOneClient } from "../../lib/client-context";
import { queryKeys } from "../../lib/query-keys";
import type { ScanIntensity, ScanState } from "./types";

export function useScanState(volumeId: VolumeId) {
  const client = usePhaseOneClient();
  return useQuery({
    queryKey: queryKeys.scan(String(volumeId)),
    queryFn: () => client.getScanState(volumeId),
    refetchInterval: (query) => (query.state.data?.status === "active" ? 1_000 : false),
  });
}

export function useScanActions(volumeId: VolumeId) {
  const client = usePhaseOneClient();
  const queryClient = useQueryClient();
  const key = queryKeys.scan(String(volumeId));

  const apply = (state: ScanState): void => {
    queryClient.setQueryData(key, state);
  };

  const start = useMutation({
    mutationFn: () => client.startScan(volumeId),
    onSuccess: (state) => {
      apply(state);
    },
  });

  const pause = useMutation({
    mutationFn: () => client.pauseScan(volumeId),
    onSuccess: (state) => {
      apply(state);
    },
  });

  const resume = useMutation({
    mutationFn: () => client.resumeScan(volumeId),
    onSuccess: (state) => {
      apply(state);
    },
  });

  const intensity = useMutation({
    mutationFn: (value: ScanIntensity) => client.setScanIntensity(volumeId, value),
    onSuccess: (state) => {
      apply(state);
    },
  });

  return { start, pause, resume, intensity };
}
