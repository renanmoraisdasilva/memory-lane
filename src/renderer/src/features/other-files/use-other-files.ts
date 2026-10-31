import { useMutation, useQuery } from "@tanstack/react-query";
import type { OtherFilesParams } from "@shared/contracts/other-files";
import { queryKeys } from "../../lib/query-keys";
import { useLibraryClient } from "../library/library-client-context";

export function useOtherFiles(params: OtherFilesParams) {
  const client = useLibraryClient();
  const category = params.category ?? "all";
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 50;
  return useQuery({
    queryKey: queryKeys.otherFiles(category, offset, limit),
    queryFn: () => client.getOtherFiles({ category, offset, limit }),
    staleTime: 10_000,
  });
}

export function useFileActions() {
  const client = useLibraryClient();
  const open = useMutation({
    mutationFn: (fileId: number) => client.openItem({ fileId }),
  });
  const reveal = useMutation({
    mutationFn: (fileId: number) => client.revealItem({ fileId }),
  });
  return { open, reveal };
}
