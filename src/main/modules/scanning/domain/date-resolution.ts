import type { TimelinePrecision } from "@shared/contracts/library";
import type { PendingMetadataFile, ResolvedFileDate } from "./scan-files";

export interface DateCandidate {
  resolvedDate: string;
  precision: TimelinePrecision;
  source: string;
  confidence: number;
  originalValue: string;
  suspicious: boolean;
  suspiciousReason: string | null;
}

export interface SuspiciousDate {
  source: string;
  originalValue: string;
  reason: string;
}

export interface DateResolution {
  date: ResolvedFileDate | null;
  suspicious: SuspiciousDate[];
}

interface DateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const FULL_DATE_PATTERN = /^(\d{4})[:\-](\d{2})[:\-](\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/;
const MONTH_PATTERN = /^(\d{4})[:\-](\d{2})$/;
const YEAR_PATTERN = /^(\d{4})$/;
const FILESYSTEM_SOURCES = new Set(["filesystem.created", "filesystem.modified"]);
const SENTINEL_DATES = new Set(["1970-01-01", "1980-01-01"]);

function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function validParts(parts: DateParts): boolean {
  if (parts.year < 1800 || parts.year > 2200) {
    return false;
  }
  if (parts.month < 1 || parts.month > 12 || parts.day < 1 || parts.day > 31) {
    return false;
  }
  if (parts.hour > 23 || parts.minute > 59 || parts.second > 59) {
    return false;
  }
  const maxDay = new Date(Date.UTC(parts.year, parts.month, 0)).getUTCDate();
  return parts.day <= maxDay;
}

function numberOr(value: unknown, fallback: number): number {
  return isInteger(value) ? value : fallback;
}

function partsFromObject(value: Record<string, unknown>): {
  parts: DateParts;
  precision: TimelinePrecision;
} | null {
  const year = value.year;
  if (!isInteger(year)) {
    return null;
  }
  const month = value.month;
  const day = value.day;
  const hasMonth = isInteger(month);
  const hasDay = hasMonth && isInteger(day);
  const parts: DateParts = {
    year,
    month: numberOr(month, 1),
    day: numberOr(day, 1),
    hour: numberOr(value.hour, 0),
    minute: numberOr(value.minute, 0),
    second: numberOr(value.second, 0),
  };
  let precision: TimelinePrecision = "year";
  if (hasMonth) {
    precision = "month";
  }
  if (hasDay) {
    precision = "exact";
  }
  return validParts(parts) ? { parts, precision } : null;
}

function partsFromString(text: string): { parts: DateParts; precision: TimelinePrecision } | null {
  const full = FULL_DATE_PATTERN.exec(text);
  if (full !== null) {
    const parts: DateParts = {
      year: Number(full[1]),
      month: Number(full[2]),
      day: Number(full[3]),
      hour: Number(full[4] ?? 0),
      minute: Number(full[5] ?? 0),
      second: Number(full[6] ?? 0),
    };
    return validParts(parts) ? { parts, precision: "exact" } : null;
  }
  const month = MONTH_PATTERN.exec(text);
  if (month !== null) {
    const parts: DateParts = {
      year: Number(month[1]),
      month: Number(month[2]),
      day: 1,
      hour: 0,
      minute: 0,
      second: 0,
    };
    return validParts(parts) ? { parts, precision: "month" } : null;
  }
  const year = YEAR_PATTERN.exec(text);
  if (year === null) {
    return null;
  }
  const parts: DateParts = {
    year: Number(year[1]),
    month: 1,
    day: 1,
    hour: 0,
    minute: 0,
    second: 0,
  };
  return validParts(parts) ? { parts, precision: "year" } : null;
}

function partsFromValue(value: unknown): { parts: DateParts; precision: TimelinePrecision } | null {
  if (typeof value === "object" && value !== null) {
    return partsFromObject(value as Record<string, unknown>);
  }
  if (typeof value !== "string") {
    return null;
  }
  return partsFromString(value.trim());
}

function renderResolvedDate(parts: DateParts): string {
  return `${String(parts.year)}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
}

function suspiciousReason(
  parts: DateParts,
  precision: TimelinePrecision,
  source: string,
  currentYear: number,
): string | null {
  if (parts.year < 1900) {
    return "Date is before 1900";
  }
  if (parts.year > currentYear + 1) {
    return "Date is in the future";
  }
  const day = `${String(parts.year)}-${pad(parts.month)}-${pad(parts.day)}`;
  if (precision === "exact" && SENTINEL_DATES.has(day)) {
    if (FILESYSTEM_SOURCES.has(source)) {
      return "Date looks like a placeholder";
    }
    if (parts.hour === 0 && parts.minute === 0 && parts.second === 0) {
      return "Date looks like a placeholder";
    }
  }
  return null;
}

function originalText(value: unknown, fallback: string): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "object" && value !== null) {
    const raw = (value as Record<string, unknown>).rawValue;
    if (typeof raw === "string" && raw.length > 0) {
      return raw;
    }
  }
  return fallback;
}

export function dateCandidateFromValue(
  value: unknown,
  source: string,
  confidence: number,
  currentYear = new Date().getUTCFullYear(),
): DateCandidate | null {
  const parsed = partsFromValue(value);
  if (parsed === null) {
    return null;
  }
  const resolvedDate = renderResolvedDate(parsed.parts);
  const reason = suspiciousReason(parsed.parts, parsed.precision, source, currentYear);
  return {
    resolvedDate,
    precision: parsed.precision,
    source,
    confidence,
    originalValue: originalText(value, resolvedDate),
    suspicious: reason !== null,
    suspiciousReason: reason,
  };
}

export function dateCandidateFromFilesystem(
  value: string | null,
  source: "filesystem.created" | "filesystem.modified",
  confidence: number,
  currentYear = new Date().getUTCFullYear(),
): DateCandidate | null {
  if (value === null) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const candidate = dateCandidateFromValue(value, source, confidence, currentYear);
  return candidate === null
    ? null
    : { ...candidate, resolvedDate: date.toISOString(), originalValue: value };
}

function toResolved(candidate: DateCandidate): ResolvedFileDate {
  return {
    resolvedDate: candidate.resolvedDate,
    precision: candidate.precision,
    source: candidate.source,
    confidence: candidate.confidence,
    originalValue: candidate.originalValue,
  };
}

export function resolveFileDate(candidates: Array<DateCandidate | null>): DateResolution {
  const present = candidates.filter((candidate): candidate is DateCandidate => candidate !== null);
  const metadataCandidates = present.filter(
    (candidate) => !FILESYSTEM_SOURCES.has(candidate.source),
  );
  const suspicious: SuspiciousDate[] = [];
  const ordered = metadataCandidates.length > 0 ? metadataCandidates : present;

  for (const candidate of ordered) {
    if (!candidate.suspicious) {
      return { date: toResolved(candidate), suspicious };
    }
    suspicious.push({
      source: candidate.source,
      originalValue: candidate.originalValue,
      reason: candidate.suspiciousReason ?? "Date looks unreliable",
    });
  }

  return { date: null, suspicious };
}

function compareFilesystemCandidates(left: DateCandidate, right: DateCandidate): number {
  const leftTime = Date.parse(left.resolvedDate);
  const rightTime = Date.parse(right.resolvedDate);
  if (leftTime !== rightTime) {
    return leftTime - rightTime;
  }
  if (left.source === right.source) {
    return 0;
  }
  return left.source === "filesystem.created" ? -1 : 1;
}

export function resolveDateForFile(
  file: PendingMetadataFile,
  metadataCandidates: Array<DateCandidate | null>,
  currentYear = new Date().getUTCFullYear(),
): DateResolution {
  const filesystemCandidates = [
    dateCandidateFromFilesystem(file.createdAtFs, "filesystem.created", 0.6, currentYear),
    dateCandidateFromFilesystem(file.modifiedAtFs, "filesystem.modified", 0.4, currentYear),
  ]
    .filter((candidate): candidate is DateCandidate => candidate !== null)
    .sort(compareFilesystemCandidates);
  return resolveFileDate([...metadataCandidates, ...filesystemCandidates]);
}
