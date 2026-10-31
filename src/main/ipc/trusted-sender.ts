import path from "node:path";
import { pathToFileURL } from "node:url";

export function rendererFileUrl(): string {
  return pathToFileURL(path.join(__dirname, "../renderer/index.html")).href;
}

export function isTrustedRendererUrl(
  candidate: string,
  expectedFileUrl: string,
  developmentUrl: string | undefined,
): boolean {
  if (candidate.length === 0) {
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return false;
  }

  if (developmentUrl !== undefined) {
    let development: URL;
    try {
      development = new URL(developmentUrl);
    } catch {
      return false;
    }
    return parsed.origin === development.origin;
  }

  return candidate === expectedFileUrl || candidate.startsWith(`${expectedFileUrl}#`);
}
