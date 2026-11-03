import { describe, expect, it } from "vitest";
import { extractExifMetadata } from "./exif-metadata";

describe("ExifTool metadata extraction", () => {
  it("[ML-SCAN-011] extracts dates, dimensions, camera, GPS, and video facts", () => {
    const metadata = extractExifMetadata({
      "EXIF:DateTimeOriginal": {
        year: 2011,
        month: 7,
        day: 4,
        hour: 15,
        minute: 30,
        second: 0,
        rawValue: "2011:07:04 15:30:00",
      },
      "EXIF:Make": "TestMake",
      "EXIF:Model": "TestModel",
      "EXIF:LensModel": "TestLens",
      "File:ImageWidth": 1920,
      "File:ImageHeight": 1080,
      GPSLatitude: 48.8584,
      GPSLongitude: 2.2945,
      GPSAltitude: 35,
      "QuickTime:Duration": "0:01:02",
      "QuickTime:VideoFrameRate": 29.97,
      "QuickTime:VideoCodec": "avc1",
    });

    expect(metadata.width).toBe(1920);
    expect(metadata.height).toBe(1080);
    expect(metadata.durationSeconds).toBe(62);
    expect(metadata.frameRate).toBe(29.97);
    expect(metadata.dateCandidates[0]).toMatchObject({
      resolvedDate: "2011-07-04T15:30:00",
      source: "exif.datetimeOriginal",
    });
    expect(metadata.entries).toEqual(
      expect.arrayContaining([
        { key: "metadata.exiftool", value: "ok", source: "exiftool" },
        { key: "camera.make", value: "TestMake", source: "exiftool" },
        { key: "camera.model", value: "TestModel", source: "exiftool" },
        { key: "camera.lens", value: "TestLens", source: "exiftool" },
        { key: "gps.latitude", value: "48.858400", source: "exiftool" },
        { key: "gps.longitude", value: "2.294500", source: "exiftool" },
        { key: "gps.altitude", value: "35", source: "exiftool" },
        { key: "media.durationSeconds", value: "62", source: "exiftool" },
        { key: "media.frameRate", value: "29.97", source: "exiftool" },
        { key: "media.videoCodec", value: "avc1", source: "exiftool" },
      ]),
    );
  });

  it("supports partial XMP dates and video creation dates", () => {
    const metadata = extractExifMetadata({
      "XMP:CreateDate": "1998-08",
      "QuickTime:CreationDate": "2004:02:03 10:00:00",
      "RIFF:Duration": 12.5,
    });

    expect(metadata.dateCandidates.map((candidate) => candidate?.precision)).toEqual([
      "exact",
      "month",
    ]);
    expect(metadata.durationSeconds).toBe(12.5);
  });

  it("parses rational frame rates and ignores invalid values", () => {
    const rational = extractExifMetadata({ "Composite:VideoFrameRate": "30000/1001" });
    expect(rational.frameRate).toBeCloseTo(29.97002997, 6);

    const invalid = extractExifMetadata({ "QuickTime:VideoFrameRate": 0 });
    expect(invalid.frameRate).toBeNull();
    expect(invalid.entries.some((entry) => entry.key === "media.frameRate")).toBe(false);
  });

  it("rejects an ExifTool error payload", () => {
    expect(() => extractExifMetadata({ "ExifTool:Error": "File is empty" })).toThrow(
      "File is empty",
    );
  });
});
