import { describe, expect, it } from "vitest";
import { isTrustedRendererUrl } from "./trusted-sender";

const expected =
  "file:///C:/Program%20Files/Memory%20Lane/resources/app.asar/out/renderer/index.html";

describe("trusted renderer URL", () => {
  it("accepts only the exact packaged renderer document and hash routes", () => {
    expect(isTrustedRendererUrl(expected, expected, undefined)).toBe(true);
    expect(isTrustedRendererUrl(`${expected}#/library`, expected, undefined)).toBe(true);
    expect(isTrustedRendererUrl(`${expected}#/settings`, expected, undefined)).toBe(true);
    expect(isTrustedRendererUrl("file:///C:/Windows/System32/evil.html", expected, undefined)).toBe(
      false,
    );
    expect(isTrustedRendererUrl(`${expected}.evil`, expected, undefined)).toBe(false);
    expect(isTrustedRendererUrl(`${expected}?query=1`, expected, undefined)).toBe(false);
    expect(isTrustedRendererUrl("", expected, undefined)).toBe(false);
    expect(isTrustedRendererUrl("not a url", expected, undefined)).toBe(false);
  });

  it("accepts only the configured development origin", () => {
    const development = "http://localhost:5173";
    expect(isTrustedRendererUrl("http://localhost:5173/", expected, development)).toBe(true);
    expect(isTrustedRendererUrl("http://localhost:5173/#/library", expected, development)).toBe(
      true,
    );
    expect(isTrustedRendererUrl("http://localhost:5173.evil.test/", expected, development)).toBe(
      false,
    );
    expect(isTrustedRendererUrl("https://localhost:5173/", expected, development)).toBe(false);
    expect(isTrustedRendererUrl("http://127.0.0.1:5173/", expected, development)).toBe(false);
    expect(isTrustedRendererUrl(expected, expected, "not a url")).toBe(false);
  });
});
