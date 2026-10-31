import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { useLibraryClient } from "./library-client-context";
import { queryKeys } from "../../lib/query-keys";
import type { LibraryFilter, LibraryTimelineParams } from "./types";

function buildTimelineParams(
  filter: LibraryFilter,
  year: number | null,
  month: number | null,
  cursor: string | null,
): LibraryTimelineParams {
  const params: LibraryTimelineParams = { filter, limit: 200 };
  if (cursor !== null) {
    params.cursor = cursor;
    return params;
  }
  if (year !== null) {
    params.year = year;
  }
  if (month !== null) {
    params.month = month;
  }
  return params;
}

export function useLibrarySummary() {
  const client = useLibraryClient();
  return useQuery({
    queryKey: queryKeys.librarySummary,
    queryFn: () => client.getSummary(),
    staleTime: 30_000,
  });
}

export function useLibraryTimeline({
  filter,
  year,
  month,
}: {
  filter: LibraryFilter;
  year: number | null;
  month: number | null;
}) {
  const client = useLibraryClient();
  return useInfiniteQuery({
    queryKey: queryKeys.libraryTimeline(filter, year, month),
    queryFn: ({ pageParam }) =>
      client.getTimeline(buildTimelineParams(filter, year, month, pageParam)),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    maxPages: 8,
    staleTime: 30_000,
  });
}

export function useLibraryTimelineIndex(filter: LibraryFilter) {
  const client = useLibraryClient();
  return useQuery({
    queryKey: queryKeys.libraryTimelineIndex(filter),
    queryFn: () => client.getTimelineIndex({ filter }),
    staleTime: 30_000,
  });
}

export function useLibraryItem(fileId: number | null, filter: LibraryFilter) {
  const client = useLibraryClient();
  return useQuery({
    queryKey: queryKeys.libraryItem(fileId ?? 0, filter),
    queryFn: () => {
      if (fileId === null) {
        throw new Error("A file id is required");
      }
      return client.getItem({ fileId, filter });
    },
    enabled: fileId !== null && fileId > 0,
    staleTime: 30_000,
  });
}

export function useLibraryItemActions(fileId: number) {
  const client = useLibraryClient();
  const reveal = useMutation({
    mutationFn: () => client.revealItem({ fileId }),
  });
  const open = useMutation({
    mutationFn: () => client.openItem({ fileId }),
  });
  return { reveal, open };
}
