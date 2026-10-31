import type { LibraryDate, TimelinePrecision } from "./types";

export interface LocalDateParts {
  year: number;
  month: number;
  day: number;
}

export function parseLibraryDate(value: string | null): Date | null {
  if (value === null) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function localDateParts(value: string | null): LocalDateParts | null {
  const date = parseLibraryDate(value);
  if (date === null) {
    return null;
  }
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}

export function dateGroupKey(date: LibraryDate): string {
  const parts = localDateParts(date.value);
  if (parts === null || date.precision === null) {
    return "undated";
  }
  if (date.precision === "exact") {
    return `exact:${parts.year}-${parts.month}-${parts.day}`;
  }
  if (date.precision === "month") {
    return `month:${parts.year}-${parts.month}`;
  }
  return `year:${parts.year}`;
}

export function formatSectionLabel(date: LibraryDate): string {
  const parts = localDateParts(date.value);
  if (parts === null || date.precision === null) {
    return "Date unavailable";
  }
  if (date.precision === "exact") {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(new Date(date.value ?? 0));
  }
  if (date.precision === "month") {
    return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(
      new Date(date.value ?? 0),
    );
  }
  return String(parts.year);
}

export function formatSectionMeta(date: LibraryDate): string {
  const parsed = parseLibraryDate(date.value);
  if (parsed === null || date.precision === null) {
    return "No resolved date";
  }
  if (date.precision === "exact") {
    return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(parsed);
  }
  return formatPrecisionLabel(date.precision);
}

export function formatPrecisionLabel(precision: TimelinePrecision | null): string {
  if (precision === "exact") {
    return "Exact date";
  }
  if (precision === "month") {
    return "Month precision";
  }
  if (precision === "year") {
    return "Year precision";
  }
  return "Date unavailable";
}

export function formatLibraryDateValue(date: LibraryDate): string {
  const parsed = parseLibraryDate(date.value);
  if (parsed === null || date.precision === null) {
    return "Date unavailable";
  }
  if (date.precision === "exact") {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(parsed);
  }
  if (date.precision === "month") {
    return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(parsed);
  }
  return String(parsed.getFullYear());
}

const DATE_SOURCE_LABELS: Record<string, string> = {
  manual: "Manual date",
  "exif.datetimeOriginal": "EXIF original date",
  "exif.createDate": "EXIF create date",
  "exif.dateTimeDigitized": "EXIF digitized date",
  "video.creationDate": "Video creation date",
  "video.createDate": "Video create date",
  "xmp.createDate": "XMP create date",
  "filesystem.created": "Filesystem created",
  "filesystem.modified": "Filesystem modified",
};

export function formatDateSource(source: string | null): string {
  if (source === null || source.trim().length === 0) {
    return "Source not recorded";
  }
  return DATE_SOURCE_LABELS[source] ?? source;
}
