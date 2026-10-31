import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { VolumeId } from "@shared/contracts/drives";
import { usePhaseOneClient } from "../../lib/client-context";
import { queryKeys } from "../../lib/query-keys";
import type { ScanIntensity, ScanState } from "./types";

export function useScanState(volumeId: VolumeId) {
  const client = usePhaseOneClient();
  const queryClient = useQueryClient();
  const previousStatus = useRef<ScanState["status"] | null>(null);
  const query = useQuery({
    queryKey: queryKeys.scan(String(volumeId)),
    queryFn: () => client.getScanState(volumeId),
    refetchInterval: (current) => (current.state.data?.status === "active" ? 1_000 : false),
  });

  useEffect(() => {
    const status = query.data?.status ?? null;
    if (status === "complete" && previousStatus.current !== "complete") {
      void queryClient.invalidateQueries({ queryKey: ["library"] });
      void queryClient.invalidateQueries({ queryKey: ["health"] });
      void queryClient.invalidateQueries({ queryKey: ["other-files"] });
    }
    previousStatus.current = status;
  }, [query.data?.status, queryClient]);

  return query;
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
