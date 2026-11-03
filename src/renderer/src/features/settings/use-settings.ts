import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../lib/query-keys";
import { useLibraryClient } from "../library/library-client-context";

export function useSettingsInfo() {
  const client = useLibraryClient();
  return useQuery({
    queryKey: queryKeys.settingsInfo,
    queryFn: () => client.getSettingsInfo(),
    staleTime: 5_000,
  });
}

export function useClearCache() {
  const client = useLibraryClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => client.clearCache(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.settingsInfo });
      void queryClient.invalidateQueries({ queryKey: ["library"] });
      void queryClient.invalidateQueries({ queryKey: ["other-files"] });
      void queryClient.invalidateQueries({ queryKey: ["health"] });
    },
  });
}

export function useRunBackup() {
  const client = useLibraryClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => client.runBackup(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.settingsInfo });
    },
  });
}
