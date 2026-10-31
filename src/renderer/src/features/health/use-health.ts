import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  DuplicateGroupsParams,
  MissingFilesParams,
  MovedCandidateTargets,
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
    queryKey: queryKeys.healthMissing(params.offset ?? 0, params.limit ?? 50),
    queryFn: () => client.getMissing(params),
    staleTime: 10_000,
  });
}

export function useHealthMoved() {
  const client = useLibraryClient();
  return useQuery({
    queryKey: queryKeys.healthMoved,
    queryFn: () => client.getMoved(),
    staleTime: 10_000,
  });
}

export function useValidationState() {
  const client = useLibraryClient();
  return useQuery({
    queryKey: queryKeys.healthValidation,
    queryFn: () => client.getValidationState(),
    refetchInterval: (query) => (query.state.data?.status === "running" ? 1_000 : false),
    staleTime: 0,
  });
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
