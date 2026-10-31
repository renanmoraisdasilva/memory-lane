import { describe, expect, it } from "vitest";
import { dateCandidateFromValue, resolveFileDate, resolveDateForFile } from "./date-resolution";
import type { PendingMetadataFile } from "./scan-files";

const file: PendingMetadataFile = {
  id: 1,
  path: "C:\\archive\\photo.jpg",
  mediaClass: "image",
  format: "JPG",
  size: 100,
  createdAtFs: "2020-05-05T10:00:00.000Z",
  modifiedAtFs: "2020-05-06T10:00:00.000Z",
};

describe("date resolution", () => {
  it("parses ExifDateTime-like values and partial dates", () => {
    const exact = dateCandidateFromValue(
      {
        year: 2011,
        month: 7,
        day: 4,
        hour: 15,
        minute: 30,
        second: 0,
        rawValue: "2011:07:04 15:30:00",
      },
      "exif.datetimeOriginal",
      0.95,
      2026,
    );
    expect(exact).toMatchObject({
      resolvedDate: "2011-07-04T15:30:00",
      precision: "exact",
      source: "exif.datetimeOriginal",
      originalValue: "2011:07:04 15:30:00",
      suspicious: false,
    });

    expect(dateCandidateFromValue("1998-08", "xmp.createDate", 0.7, 2026)).toMatchObject({
      resolvedDate: "1998-08-01T00:00:00",
      precision: "month",
    });
    expect(dateCandidateFromValue("1998", "xmp.createDate", 0.7, 2026)).toMatchObject({
      resolvedDate: "1998-01-01T00:00:00",
      precision: "year",
    });
  });

  it("prefers metadata dates over filesystem dates", () => {
    const result = resolveDateForFile(file, [
      dateCandidateFromValue("2011:07:04 15:30:00", "exif.datetimeOriginal", 0.95, 2026),
    ]);
    expect(result.date).toMatchObject({
      resolvedDate: "2011-07-04T15:30:00",
      source: "exif.datetimeOriginal",
    });
    expect(result.suspicious).toEqual([]);
  });

  it("falls back to filesystem timestamps when metadata is absent", () => {
    const result = resolveDateForFile(file, []);
    expect(result.date).toMatchObject({
      resolvedDate: "2020-05-05T10:00:00.000Z",
      source: "filesystem.created",
      precision: "exact",
    });
  });

  it("rejects invalid values and flags suspicious metadata", () => {
    expect(dateCandidateFromValue("not a date", "exif.createDate", 0.9, 2026)).toBeNull();
    const future = dateCandidateFromValue(
      "2099:01:01 00:00:00",
      "exif.dateTimeOriginal",
      0.95,
      2026,
    );
    expect(future).toMatchObject({ suspicious: true, suspiciousReason: "Date is in the future" });

    const result = resolveFileDate([future]);
    expect(result.date).toBeNull();
    expect(result.suspicious).toEqual([
      {
        source: "exif.dateTimeOriginal",
        originalValue: "2099:01:01 00:00:00",
        reason: "Date is in the future",
      },
    ]);
  });

  it("does not use a filesystem fallback for suspicious metadata", () => {
    const result = resolveDateForFile(file, [
      dateCandidateFromValue("1970:01:01 00:00:00", "exif.datetimeOriginal", 0.95, 2026),
    ]);
    expect(result.date).toBeNull();
    expect(result.suspicious[0]?.reason).toBe("Date looks like a placeholder");
  });

  it("uses a lower-priority metadata date when the best one is invalid", () => {
    const result = resolveDateForFile(file, [
      null,
      dateCandidateFromValue("2011:07:04 15:31:00", "exif.createDate", 0.9, 2026),
    ]);
    expect(result.date).toMatchObject({ source: "exif.createDate" });
  });
});
