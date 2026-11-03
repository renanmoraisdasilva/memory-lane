import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createContext } from "./context.mjs";
import { writeText } from "./io.mjs";
import { collectTags, validateLedger, validateReferences, verifyEvidence } from "./ledger.mjs";
import { resultsAreStale } from "./results.mjs";
import { renderMatrix, renderReview } from "./render.mjs";
import { parseImpactArgs, resolveImpact } from "./impact.mjs";

const roots = [];

afterEach(async () => {
  for (const root of roots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

function today() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function requirement(overrides = {}) {
  return {
    id: "ML-TEST-001",
    batch: 1,
    capability: "test",
    kind: "outcome",
    title: "Test requirement",
    text: "The app does the thing.",
    sources: ["docs/spec.md"],
    adrs: [],
    contracts: [],
    implementation: [],
    verificationMethod: "automated-test",
    testNotes: "",
    status: "verified",
    conflictsWith: [],
    notes: "",
    ...overrides,
  };
}

function ledger(requirements = [requirement()]) {
  return {
    schemaVersion: 2,
    project: "Test",
    updated: today(),
    statusValues: [
      "needs-review",
      "accepted",
      "implemented",
      "verified",
      "superseded",
      "non-goal",
      "deferred",
    ],
    kindValues: ["outcome", "invariant", "constraint", "non-goal"],
    verificationMethodValues: ["automated-test", "automated-check", "manual", "inspection"],
    batches: [
      {
        id: 1,
        title: "Test batch",
        capability: "test",
        status: "accepted",
        reviewSheet: "docs/traceability/reviews/01-test.md",
      },
    ],
    requirements,
    conflicts: [],
  };
}

async function makeRepo(data, files = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "ml-trace-"));
  roots.push(root);
  await writeText(
    path.join(root, "docs/traceability/requirements.json"),
    `${JSON.stringify(data, null, 2)}\n`,
  );
  for (const [relativePath, content] of Object.entries(files)) {
    await writeText(path.join(root, relativePath), content);
  }
  return root;
}

describe("traceability ledger validation", () => {
  it("accepts a valid ledger", () => {
    const result = validateLedger(ledger());
    expect(result.errors).toEqual([]);
  });

  it("rejects duplicate ids, unknown statuses, and missing methods", () => {
    const result = validateLedger(
      ledger([
        requirement(),
        requirement(),
        requirement({ id: "ML-TEST-002", status: "done" }),
        requirement({ id: "ML-TEST-003", verificationMethod: undefined }),
      ]),
    );
    expect(result.errors).toContain("ML-TEST-001: duplicate id.");
    expect(result.errors).toContain("ML-TEST-002: unknown status done.");
    expect(result.errors).toContain("ML-TEST-003: verified requires a valid verificationMethod.");
  });

  it("rejects the retired currentText, proposedText, and tests fields", () => {
    const result = validateLedger(
      ledger([requirement({ currentText: "old", proposedText: "new", tests: ["a.test.ts"] })]),
    );
    expect(result.errors).toContain(
      "ML-TEST-001: use text and optional sourceText, not currentText/proposedText.",
    );
    expect(result.errors).toContain(
      "ML-TEST-001: tests links are derived from ID tags; remove the tests field.",
    );
  });

  it("rejects a future updated date", () => {
    const future = new Date();
    future.setDate(future.getDate() + 1);
    const iso = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, "0")}-${String(future.getDate()).padStart(2, "0")}`;
    expect(validateLedger(ledger()).errors).toEqual([]);
    expect(validateLedger({ ...ledger(), updated: iso }).errors).toContain(
      `ledger updated ${iso} is in the future.`,
    );
  });
});

describe("traceability references", () => {
  it("checks source files, anchors, and implementation paths", async () => {
    const data = ledger([
      requirement({
        sources: ["docs/spec.md#source"],
        implementation: ["src/main/db"],
      }),
    ]);
    const root = await makeRepo(data, {
      "docs/spec.md": "# Source\n\nText.\n",
      "src/main/db/connection.ts": "export const value = 1;\n",
    });
    await expect(validateReferences(data, createContext(root))).resolves.toEqual([]);

    const broken = ledger([
      requirement({
        sources: ["docs/spec.md#missing-anchor", "docs/gone.md"],
        implementation: ["src/main/missing"],
      }),
    ]);
    const brokenRoot = await makeRepo(broken, { "docs/spec.md": "# Source\n" });
    const errors = await validateReferences(broken, createContext(brokenRoot));
    expect(errors).toContain("ML-TEST-001: missing anchor docs/spec.md#missing-anchor.");
    expect(errors).toContain("ML-TEST-001: missing source docs/gone.md.");
    expect(errors).toContain("ML-TEST-001: missing implementation src/main/missing.");
  });
});

describe("traceability evidence", () => {
  it("derives test links from tags and warns about tags outside tests", async () => {
    const root = await makeRepo(ledger(), {
      "src/feature.test.ts": 'it("[ML-TEST-001] works", () => {});\n',
      "src/feature.ts": "// [ML-TEST-999] is not evidence\n",
    });
    const context = createContext(root);
    const result = await collectTags(context);
    expect([...result.tags.get("ML-TEST-001")]).toEqual(["src/feature.test.ts"]);
    expect(result.tags.has("ML-TEST-999")).toBe(false);
    expect(result.warnings[0]).toContain("ID tag in non-test file src/feature.ts");
  });

  it("rejects a verified automated requirement without a tag", async () => {
    const data = ledger();
    const root = await makeRepo(data);
    const { tags } = await collectTags(createContext(root));
    const result = verifyEvidence(data, tags, null);
    expect(result.errors).toContain(
      "ML-TEST-001: verified but no [ML-TEST-001] tag exists in a test file.",
    );
  });

  it("rejects orphan tags", async () => {
    const data = ledger();
    const root = await makeRepo(data, {
      "src/feature.test.ts": 'it("[ML-OTHER-001] works", () => {});\n',
    });
    const { tags } = await collectTags(createContext(root));
    const result = verifyEvidence(data, tags, null);
    expect(result.errors).toContain("Orphan ID tag ML-OTHER-001: no requirement uses it.");
  });

  it("requires a passing result in strict mode and only warns otherwise", () => {
    const data = ledger();
    const tags = new Map([["ML-TEST-001", new Set(["src/feature.test.ts"])]]);
    const failed = new Map([["ML-TEST-001", ["failed"]]]);
    expect(verifyEvidence(data, tags, failed).warnings.join(" ")).toContain(
      "ID-tagged test result is failed.",
    );
    expect(verifyEvidence(data, tags, failed, { requireResults: true }).errors.join(" ")).toContain(
      "ID-tagged test result is failed.",
    );
    expect(verifyEvidence(data, tags, null, { requireResults: true }).errors.join(" ")).toContain(
      "no test results are available",
    );
    expect(
      verifyEvidence(data, tags, new Map([["ML-TEST-001", ["passed"]]]), { requireResults: true })
        .errors,
    ).toEqual([]);
  });

  it("accepts manual evidence with a note and rejects it without one", () => {
    const manual = ledger([requirement({ verificationMethod: "manual" })]);
    const tags = new Map();
    expect(verifyEvidence(manual, tags, null).errors).toContain(
      "ML-TEST-001: verified manual requirement needs a test note.",
    );
    const withNote = ledger([
      requirement({ verificationMethod: "manual", testNotes: "Real-drive pass on 2026-11-03." }),
    ]);
    expect(verifyEvidence(withNote, tags, null).errors).toEqual([]);
  });

  it("accepts a script check when an implementation path is recorded", () => {
    const data = ledger([
      requirement({
        verificationMethod: "automated-check",
        implementation: ["scripts/verify-package.mjs"],
      }),
    ]);
    const result = verifyEvidence(data, new Map(), null);
    expect(result.errors).toEqual([]);
  });

  it("detects stale test results", async () => {
    const root = await makeRepo(ledger(), { "src/feature.test.ts": "it('x', () => {});\n" });
    const context = createContext(root);
    const files = new Set(["src/feature.test.ts"]);
    await expect(resultsAreStale(context, { startTime: Date.now() }, files)).resolves.toBe(false);
    await expect(resultsAreStale(context, { startTime: 0 }, files)).resolves.toBe(true);
  });
});

describe("traceability rendering", () => {
  it("renders derived links, methods, and result states", async () => {
    const data = ledger([
      requirement({ id: "ML-TEST-001", title: "Passes" }),
      requirement({ id: "ML-TEST-002", title: "Manual", verificationMethod: "manual" }),
      requirement({
        id: "ML-TEST-003",
        title: "Script",
        verificationMethod: "automated-check",
        implementation: ["scripts/check.mjs"],
      }),
      requirement({ id: "ML-TEST-004", title: "E2E" }),
      requirement({ id: "ML-TEST-005", title: "Non-goal", status: "non-goal" }),
      requirement({ id: "ML-TEST-006", title: "Deferred", status: "deferred" }),
    ]);
    const tags = new Map([
      ["ML-TEST-001", new Set(["src/feature.test.ts"])],
      ["ML-TEST-004", new Set(["tests/e2e/app.spec.ts"])],
    ]);
    const results = new Map([["ML-TEST-001", ["passed"]]]);
    const matrix = renderMatrix(data, tags, results);
    expect(matrix).toContain(
      "| ML-TEST-001 | Passes | outcome | verified | automated-test | 1 | pass |",
    );
    expect(matrix).toContain("| ML-TEST-002 | Manual | outcome | verified | manual | 0 | manual |");
    expect(matrix).toContain(
      "| ML-TEST-003 | Script | outcome | verified | automated-check | 0 | script |",
    );
    expect(matrix).toContain(
      "| ML-TEST-004 | E2E | outcome | verified | automated-test | 1 | e2e |",
    );
    expect(matrix).toContain(
      "| ML-TEST-005 | Non-goal | outcome | non-goal | automated-test | 0 | non-goal |",
    );
    expect(matrix).toContain(
      "| ML-TEST-006 | Deferred | outcome | deferred | automated-test | 0 | deferred |",
    );

    const review = renderReview(data, data.batches[0], tags);
    expect(review).toContain("- **Proving tests:** `src/feature.test.ts`");
    expect(review).toContain("- **Verification:** automated-check");
  });
});

describe("traceability impact", () => {
  it("maps changed sources, implementation paths, and tagged tests", () => {
    const data = ledger([
      requirement({
        sources: ["docs/spec.md#source"],
        implementation: ["src/main/db"],
      }),
    ]);
    const tags = new Map([["ML-TEST-001", new Set(["src/feature.test.ts"])]]);
    const matches = resolveImpact(
      data,
      tags,
      ["docs/spec.md", "src/main/db/connection.ts", "src/feature.test.ts"],
      process.cwd(),
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].hits).toEqual([
      "docs/spec.md",
      "src/main/db/connection.ts",
      "src/feature.test.ts",
    ]);
    expect(resolveImpact(data, tags, ["docs/unrelated.md"], process.cwd())).toEqual([]);
  });

  it("parses git and json options", () => {
    expect(parseImpactArgs(["--staged", "--json"])).toMatchObject({
      staged: true,
      json: true,
      paths: [],
    });
    expect(parseImpactArgs(["--since", "HEAD~1", "src/a.ts"])).toMatchObject({
      since: "HEAD~1",
      paths: ["src/a.ts"],
    });
    expect(() => parseImpactArgs(["--unknown"])).toThrow("Unknown option --unknown.");
    expect(() => parseImpactArgs(["--since"])).toThrow("--since needs a git ref.");
  });
});
