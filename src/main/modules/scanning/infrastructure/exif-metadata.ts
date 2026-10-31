import { ExifTool, type GroupedTags } from "exiftool-vendored";
import type { MetadataEntry } from "../domain/scan-files";
import { dateCandidateFromValue, type DateCandidate } from "../domain/date-resolution";

export interface ExifMetadata {
  entries: MetadataEntry[];
  dateCandidates: Array<DateCandidate | null>;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
}

export interface ExifMetadataReader {
  read(filePath: string): Promise<ExifMetadata>;
  shutdown(): Promise<void>;
}

interface DateField {
  group: string;
  name: string;
  source: string;
  confidence: number;
}

const FALLBACK_DATE_NAMES = [
  "DateTimeOriginal",
  "CreationDate",
  "CreateDate",
  "MediaCreateDate",
  "TrackCreateDate",
  "DateUTC",
];

const DATE_FIELDS: DateField[] = [
  { group: "EXIF", name: "DateTimeOriginal", source: "exif.datetimeOriginal", confidence: 0.95 },
  { group: "EXIF", name: "CreateDate", source: "exif.createDate", confidence: 0.9 },
  {
    group: "EXIF",
    name: "DateTimeDigitized",
    source: "exif.dateTimeDigitized",
    confidence: 0.85,
  },
  { group: "QuickTime", name: "CreationDate", source: "video.creationDate", confidence: 0.9 },
  { group: "QuickTime", name: "CreateDate", source: "video.createDate", confidence: 0.88 },
  {
    group: "QuickTime",
    name: "ContentCreateDate",
    source: "video.contentCreateDate",
    confidence: 0.85,
  },
  {
    group: "QuickTime",
    name: "MediaCreateDate",
    source: "video.mediaCreateDate",
    confidence: 0.82,
  },
  {
    group: "QuickTime",
    name: "TrackCreateDate",
    source: "video.trackCreateDate",
    confidence: 0.8,
  },
  {
    group: "RIFF",
    name: "DateTimeOriginal",
    source: "video.riffDateTimeOriginal",
    confidence: 0.8,
  },
  { group: "RIFF", name: "CreationDate", source: "video.riffCreationDate", confidence: 0.78 },
  { group: "Matroska", name: "DateUTC", source: "video.dateUtc", confidence: 0.8 },
  {
    group: "Matroska",
    name: "CreationDate",
    source: "video.matroskaCreationDate",
    confidence: 0.78,
  },
  { group: "XMP", name: "CreateDate", source: "xmp.createDate", confidence: 0.75 },
  { group: "XMP", name: "DateCreated", source: "xmp.dateCreated", confidence: 0.72 },
];

const WIDTH_FIELDS: Array<[string, string]> = [
  ["File", "ImageWidth"],
  ["EXIF", "ExifImageWidth"],
  ["EXIF", "ImageWidth"],
  ["QuickTime", "ImageWidth"],
  ["RIFF", "ImageWidth"],
  ["Matroska", "ImageWidth"],
  ["Composite", "ImageWidth"],
];

const HEIGHT_FIELDS: Array<[string, string]> = [
  ["File", "ImageHeight"],
  ["EXIF", "ExifImageHeight"],
  ["EXIF", "ImageHeight"],
  ["QuickTime", "ImageHeight"],
  ["RIFF", "ImageHeight"],
  ["Matroska", "ImageHeight"],
  ["Composite", "ImageHeight"],
];

const DURATION_FIELDS: Array<[string, string]> = [
  ["QuickTime", "Duration"],
  ["RIFF", "Duration"],
  ["Matroska", "Duration"],
  ["Composite", "Duration"],
];

function toTagBag(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function tagValue(tags: Record<string, unknown>, group: string, name: string): unknown {
  return tags[`${group}:${name}`];
}

function firstValue(tags: Record<string, unknown>, fields: Array<[string, string]>): unknown {
  for (const [group, name] of fields) {
    const value = tagValue(tags, group, name);
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return undefined;
}

function asPositiveInteger(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function validClockParts(parts: number[]): boolean {
  return parts.length >= 2 && parts.length <= 3 && parts.every((part) => Number.isFinite(part));
}

function secondsForClockParts(parts: number[]): number {
  if (parts.length === 3) {
    return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
  }
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
}

function parseClockDuration(text: string): number | null {
  const parts = text.split(":").map((part) => Number(part));
  if (!validClockParts(parts)) {
    return null;
  }
  const seconds = secondsForClockParts(parts);
  return seconds >= 0 ? seconds : null;
}

function parseDuration(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  if (typeof value !== "string") {
    return null;
  }
  const text = value.trim();
  if (/^\d+(?:\.\d+)?$/.test(text)) {
    const seconds = Number(text);
    return Number.isFinite(seconds) ? seconds : null;
  }
  return parseClockDuration(text);
}

function textValue(value: unknown): string | null {
  if (typeof value === "string") {
    return value.trim().length === 0 ? null : value.trim().slice(0, 500);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function entry(key: string, value: string): MetadataEntry {
  return { key, value, source: "exiftool" };
}

function addText(entries: MetadataEntry[], key: string, value: unknown): void {
  const text = textValue(value);
  if (text !== null) {
    entries.push(entry(key, text));
  }
}

function addNumber(entries: MetadataEntry[], key: string, value: unknown): void {
  if (typeof value === "number" && Number.isFinite(value)) {
    entries.push(entry(key, String(value)));
  }
}

function gpsEntries(tags: Record<string, unknown>): MetadataEntry[] {
  const entries: MetadataEntry[] = [];
  const latitude = tags.GPSLatitude;
  const longitude = tags.GPSLongitude;
  if (typeof latitude === "number" && Number.isFinite(latitude)) {
    entries.push(entry("gps.latitude", latitude.toFixed(6)));
  }
  if (typeof longitude === "number" && Number.isFinite(longitude)) {
    entries.push(entry("gps.longitude", longitude.toFixed(6)));
  }
  addNumber(entries, "gps.altitude", tags.GPSAltitude);
  return entries;
}

function dateEntries(tags: Record<string, unknown>): MetadataEntry[] {
  const entries: MetadataEntry[] = [];
  for (const field of DATE_FIELDS) {
    const value = tagValue(tags, field.group, field.name);
    addText(entries, `date.${field.source}`, value);
  }
  return entries;
}

function cameraEntries(tags: Record<string, unknown>): MetadataEntry[] {
  const entries: MetadataEntry[] = [];
  addText(
    entries,
    "camera.make",
    firstValue(tags, [
      ["EXIF", "Make"],
      ["QuickTime", "Make"],
    ]),
  );
  addText(
    entries,
    "camera.model",
    firstValue(tags, [
      ["EXIF", "Model"],
      ["QuickTime", "Model"],
    ]),
  );
  addText(entries, "camera.lens", firstValue(tags, [["EXIF", "LensModel"]]));
  addText(
    entries,
    "media.videoCodec",
    firstValue(tags, [
      ["QuickTime", "VideoCodec"],
      ["QuickTime", "CompressorName"],
      ["RIFF", "VideoCodec"],
      ["Matroska", "VideoCodec"],
    ]),
  );
  return entries;
}

function fallbackDateCandidate(tags: Record<string, unknown>): DateCandidate | null {
  for (const name of FALLBACK_DATE_NAMES) {
    for (const [key, value] of Object.entries(tags)) {
      if (!key.endsWith(`:${name}`) || value === undefined || value === null || value === "") {
        continue;
      }
      const group = key.slice(0, key.indexOf(":"));
      const candidate = dateCandidateFromValue(value, `exiftool.${group}.${name}`, 0.7);
      if (candidate !== null) {
        return candidate;
      }
    }
  }
  return null;
}

export function extractExifMetadata(tagsValue: unknown): ExifMetadata {
  const tags = toTagBag(tagsValue);
  if (typeof tags["ExifTool:Error"] === "string" || typeof tags.Error === "string") {
    const message = textValue(tags["ExifTool:Error"] ?? tags.Error) ?? "ExifTool read failed";
    throw new Error(message);
  }

  const entries: MetadataEntry[] = [entry("metadata.exiftool", "ok")];
  const width = asPositiveInteger(firstValue(tags, WIDTH_FIELDS));
  const height = asPositiveInteger(firstValue(tags, HEIGHT_FIELDS));
  const durationSeconds = parseDuration(firstValue(tags, DURATION_FIELDS));
  if (width !== null) {
    entries.push(entry("media.width", String(width)));
  }
  if (height !== null) {
    entries.push(entry("media.height", String(height)));
  }
  if (durationSeconds !== null) {
    entries.push(entry("media.durationSeconds", String(durationSeconds)));
  }
  entries.push(...dateEntries(tags), ...cameraEntries(tags), ...gpsEntries(tags));

  const dateCandidates = DATE_FIELDS.map((field) =>
    dateCandidateFromValue(tagValue(tags, field.group, field.name), field.source, field.confidence),
  ).filter((candidate): candidate is DateCandidate => candidate !== null);

  if (dateCandidates.length === 0) {
    const fallback = fallbackDateCandidate(tags);
    if (fallback !== null) {
      dateCandidates.push(fallback);
    }
  }

  return { entries, dateCandidates, width, height, durationSeconds };
}

export function createExifMetadataReader(): ExifMetadataReader {
  const exiftool = new ExifTool({
    maxProcs: 2,
    taskTimeoutMillis: 20_000,
  });

  return {
    async read(filePath: string): Promise<ExifMetadata> {
      const tags = await exiftool.read<GroupedTags>(filePath, { groupNames: true });
      return extractExifMetadata(tags);
    },
    async shutdown(): Promise<void> {
      await exiftool.end();
    },
  };
}
