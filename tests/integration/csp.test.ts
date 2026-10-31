import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

async function readCsp(): Promise<string> {
  const html = await readFile(new URL("../../src/renderer/index.html", import.meta.url), "utf8");
  const match = /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/.exec(html);
  if (match?.[1] === undefined) {
    throw new Error("The renderer CSP meta tag is missing");
  }
  return match[1];
}

function directives(csp: string): Map<string, string> {
  return new Map(
    csp
      .split(";")
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      .map((part) => {
        const [name, ...values] = part.split(/\s+/);
        return [name ?? "", values.join(" ")];
      }),
  );
}

describe("renderer content security policy", () => {
  it("keeps scripts self-only and blocks embedded content", async () => {
    const csp = await readCsp();
    const map = directives(csp);

    expect(map.get("default-src")).toBe("'self'");
    expect(map.get("script-src")).toBe("'self'");
    expect(map.get("object-src")).toBe("'none'");
    expect(map.get("base-uri")).toBe("'none'");
    expect(map.get("form-action")).toBe("'none'");
    expect(map.get("frame-src")).toBe("'none'");
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it("allows local media and only local development sockets", async () => {
    const csp = await readCsp();
    const map = directives(csp);
    const connect = map.get("connect-src") ?? "";

    expect(map.get("img-src")).toContain("ml-media:");
    expect(map.get("media-src")).toContain("ml-media:");
    expect(connect).toContain("'self'");
    expect(connect).toContain("ws://localhost:*");
    expect(csp).not.toMatch(/https?:/);
    expect(csp).not.toContain(" *");
  });
});
