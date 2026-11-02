import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  DuplicateGroupsParams,
  MissingFileTargets,
  MissingFilesParams,
  MovedCandidateTargets,
  MovedCandidatesParams,
  PurgeMissingDuplicatesParams,
  ValidationStartParams,
} from "@shared/contracts/health";
import { queryKeys } from "../../lib/query-keys";
import { useLibraryClient } from "../library/library-client-context";

export function useHealthSummary() {
  const client = useLibraryClient();
  return useQuery({
    queryKey: queryKeys.healthSummary,
    queryFn: () => client.getHealthSummary(),
    staleTime: 10_000,
  });
}

export function useHealthDuplicates(params: DuplicateGroupsParams) {
  const client = useLibraryClient();
  return useQuery({
    queryKey: queryKeys.healthDuplicates(params.offset ?? 0, params.limit ?? 25),
    queryFn: () => client.getDuplicates(params),
    staleTime: 10_000,
  });
}

export function useHealthMissing(params: MissingFilesParams) {
  const client = useLibraryClient();
  return useQuery({
    queryKey: queryKeys.healthMissing(
      params.offset ?? 0,
      params.limit ?? 50,
      params.dismissedOnly ?? false,
    ),
    queryFn: () => client.getMissing(params),
    staleTime: 10_000,
  });
}

export function useHealthMissingDuplicates() {
  const client = useLibraryClient();
  return useQuery({
    queryKey: queryKeys.healthMissingDuplicates,
    queryFn: () => client.getMissingDuplicates({ limit: 100 }),
    staleTime: 10_000,
  });
}

export function usePurgeMissingDuplicates() {
  const client = useLibraryClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: PurgeMissingDuplicatesParams) => client.purgeMissingDuplicates(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["health"] });
      void queryClient.invalidateQueries({ queryKey: ["library"] });
      void queryClient.invalidateQueries({ queryKey: ["replication"] });
    },
  });
}

export function useHealthMoved(params: MovedCandidatesParams) {
  const client = useLibraryClient();
  return useQuery({
    queryKey: queryKeys.healthMoved(params.offset ?? 0, params.limit ?? 50),
    queryFn: () => client.getMoved(params),
    staleTime: 10_000,
  });
}

export function useValidationState() {
  const client = useLibraryClient();
  const queryClient = useQueryClient();
  const previousStatus = useRef<string | null>(null);
  const query = useQuery({
    queryKey: queryKeys.healthValidation,
    queryFn: () => client.getValidationState(),
    refetchInterval: (current) => (current.state.data?.status === "running" ? 1_000 : false),
    staleTime: 0,
  });

  useEffect(() => {
    const status = query.data?.status ?? null;
    const finished = status === "complete" || status === "failed";
    if (finished && previousStatus.current !== status) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.healthSummary });
      void queryClient.invalidateQueries({ queryKey: ["library"] });
    }
    previousStatus.current = status;
  }, [query.data?.status, queryClient]);

  return query;
}

function useHealthMutation<TParams, TResult>(mutationFn: (params: TParams) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["health"] });
      void queryClient.invalidateQueries({ queryKey: ["library"] });
    },
  });
}

export function useConfirmMoved() {
  const client = useLibraryClient();
  return useHealthMutation((params: MovedCandidateTargets) => client.confirmMoved(params));
}

export function useDismissMoved() {
  const client = useLibraryClient();
  return useHealthMutation((params: MovedCandidateTargets) => client.dismissMoved(params));
}

export function useDismissMissing() {
  const client = useLibraryClient();
  return useHealthMutation((params: MissingFileTargets) => client.dismissMissing(params));
}

export function useRestoreMissing() {
  const client = useLibraryClient();
  return useHealthMutation((params: MissingFileTargets) => client.restoreMissing(params));
}

export function useStartValidation() {
  const client = useLibraryClient();
  return useHealthMutation((params: ValidationStartParams) => client.startValidation(params));
}

export function usePauseValidation() {
  const client = useLibraryClient();
  return useHealthMutation(() => client.pauseValidation());
}

export function useResumeValidation() {
  const client = useLibraryClient();
  return useHealthMutation(() => client.resumeValidation());
}
