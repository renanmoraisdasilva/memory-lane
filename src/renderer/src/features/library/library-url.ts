import type { LibraryDensity, LibraryFilter } from "./types";

export function parseLibraryFilter(value: string | null): LibraryFilter {
  if (value === "photos" || value === "videos") {
    return value;
  }
  return "all";
}

export function parseLibraryDensity(value: string | null): LibraryDensity {
  return value === "dense" ? "dense" : "comfortable";
}

export function parseFileId(value: string | undefined): number | null {
  if (value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function appendParams(path: string, filter: LibraryFilter, density: LibraryDensity): string {
  const params = new URLSearchParams();
  if (filter !== "all") {
    params.set("filter", filter);
  }
  if (density !== "comfortable") {
    params.set("density", density);
  }
  const query = params.toString();
  return query.length === 0 ? path : `${path}?${query}`;
}

export function libraryPath(filter: LibraryFilter, density: LibraryDensity): string {
  return appendParams("/library", filter, density);
}

export function viewerPath(fileId: number, filter: LibraryFilter, density: LibraryDensity): string {
  return appendParams(`/library/item/${String(fileId)}`, filter, density);
}
