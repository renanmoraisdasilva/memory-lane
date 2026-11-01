import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AdoptionState,
  ReplicationRunState,
  StartRunParams,
} from "@shared/contracts/replication/types";
import { queryKeys } from "../../lib/query-keys";
import { useReplicationClient } from "./replication-client-context";

export function useReplicationOverview() {
  const client = useReplicationClient();
  return useQuery({
    queryKey: queryKeys.replicationOverview,
    queryFn: () => client.getOverview(),
    staleTime: 10_000,
  });
}

export function useReplicationPlan() {
  const client = useReplicationClient();
  return useQuery({
    queryKey: queryKeys.replicationPlan,
    queryFn: () => client.getPlan(),
    staleTime: 5_000,
  });
}

export function useReplicationDestination(destinationId: string) {
  const client = useReplicationClient();
  return useQuery({
    queryKey: queryKeys.replicationDestination(destinationId),
    queryFn: () => client.getDestination(destinationId),
    staleTime: 5_000,
  });
}

export function useDestinationCandidates(enabled: boolean) {
  const client = useReplicationClient();
  return useQuery({
    queryKey: [...queryKeys.replicationDestinations, "candidates"],
    queryFn: () => client.listDestinationCandidates(),
    enabled,
    staleTime: 2_000,
  });
}

function adoptionPollInterval(state: AdoptionState | undefined): number | false {
  if (state === undefined) {
    return false;
  }
  if (state.status === "scanning" || state.status === "hashing") {
    return 1_000;
  }
  if (state.status === "paused") {
    return 2_000;
  }
  return false;
}

export function useAdoptionState(destinationId: string) {
  const client = useReplicationClient();
  return useQuery({
    queryKey: queryKeys.replicationAdoption(destinationId),
    queryFn: () => client.getAdoptionState(destinationId),
    refetchInterval: (query) => adoptionPollInterval(query.state.data),
  });
}

export function useReplicationInvalidation() {
  const queryClient = useQueryClient();
  return async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.replicationOverview }),
      queryClient.invalidateQueries({ queryKey: queryKeys.replicationPlan }),
      queryClient.invalidateQueries({ queryKey: queryKeys.replicationDestinations }),
      queryClient.invalidateQueries({ queryKey: ["replication", "destination"] }),
      queryClient.invalidateQueries({ queryKey: ["replication", "adoption"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.replicationRun }),
      queryClient.invalidateQueries({ queryKey: ["replication", "run-events"] }),
    ]);
  };
}

export function useRegisterDestination() {
  const client = useReplicationClient();
  const invalidate = useReplicationInvalidation();
  return useMutation({
    mutationFn: (params: Parameters<typeof client.registerDestination>[0]) =>
      client.registerDestination(params),
    onSuccess: invalidate,
  });
}

export function useUpdateDestination() {
  const client = useReplicationClient();
  const invalidate = useReplicationInvalidation();
  return useMutation({
    mutationFn: (params: Parameters<typeof client.updateDestination>[0]) =>
      client.updateDestination(params),
    onSuccess: invalidate,
  });
}

export function useAdoptionControl(destinationId: string) {
  const client = useReplicationClient();
  const invalidate = useReplicationInvalidation();
  const onSuccess = async (): Promise<void> => {
    await invalidate();
  };
  return {
    start: useMutation({ mutationFn: () => client.startAdoption(destinationId), onSuccess }),
    pause: useMutation({ mutationFn: () => client.pauseAdoption(destinationId), onSuccess }),
    resume: useMutation({ mutationFn: () => client.resumeAdoption(destinationId), onSuccess }),
  };
}

function runPollInterval(state: ReplicationRunState | null | undefined): number | false {
  if (state === undefined || state === null) {
    return false;
  }
  if (state.status === "running" || state.status === "stopping") {
    return 1_000;
  }
  if (state.status === "paused") {
    return 2_000;
  }
  return false;
}

export function useRunState() {
  const client = useReplicationClient();
  return useQuery({
    queryKey: queryKeys.replicationRun,
    queryFn: () => client.getRunState(),
    refetchInterval: (query) => runPollInterval(query.state.data),
  });
}

export function useRunEvents(runId: number | null) {
  const client = useReplicationClient();
  return useQuery({
    queryKey: queryKeys.replicationRunEvents(runId ?? 0),
    queryFn: () => client.getRunEvents({ runId: runId ?? 0, limit: 50 }),
    enabled: runId !== null,
  });
}

export function useStartRun() {
  const client = useReplicationClient();
  const invalidate = useReplicationInvalidation();
  return useMutation({
    mutationFn: (params: StartRunParams) => client.startRun(params),
    onSuccess: invalidate,
  });
}

export function useRunControl() {
  const client = useReplicationClient();
  const invalidate = useReplicationInvalidation();
  const onSuccess = async (): Promise<void> => {
    await invalidate();
  };
  return {
    pause: useMutation({ mutationFn: () => client.pauseRun(), onSuccess }),
    resume: useMutation({ mutationFn: () => client.resumeRun(), onSuccess }),
    stop: useMutation({ mutationFn: () => client.requestStop(), onSuccess }),
    replan: useMutation({ mutationFn: () => client.replan(), onSuccess }),
  };
}
