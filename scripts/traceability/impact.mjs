import path from "node:path";
import { fileURLToPath } from "node:url";
import { createContext } from "./lib/context.mjs";
import { readJson } from "./lib/io.mjs";
import { collectTags } from "./lib/ledger.mjs";
import { formatImpact, gitChangedPaths, parseImpactArgs, resolveImpact } from "./lib/impact.mjs";

const HELP = `Usage:
  npm run trace:impact -- <path> [<path> ...]
  npm run trace:impact -- --staged
  npm run trace:impact -- --since <git-ref>
  npm run trace:impact -- --json <path> [<path> ...]

Maps changed files to requirement IDs, their verification method, and the tests
that carry their IDs. Paths may be files or directories.`;

export async function run({ root = process.cwd(), argv = process.argv.slice(2) } = {}) {
  let options;
  try {
    options = parseImpactArgs(argv);
  } catch (error) {
    console.error(error.message);
    return 1;
  }
  if (options.help) {
    console.log(HELP);
    return 0;
  }

  let paths;
  try {
    paths = options.paths.length > 0 ? options.paths : gitChangedPaths(root, options);
  } catch (error) {
    console.error(`Could not read git changes: ${error.message}`);
    return 1;
  }
  if (paths.length === 0) {
    console.log("No changed paths.");
    return 0;
  }

  const context = createContext(root);
  const ledger = await readJson(context.ledgerPath);
  const { tags } = await collectTags(context);
  const matches = resolveImpact(ledger, tags, paths, root);

  if (options.json) {
    const payload = {
      paths,
      matches: matches.map(({ requirement, hits, tests }) => ({
        id: requirement.id,
        title: requirement.title,
        status: requirement.status,
        verificationMethod: requirement.verificationMethod ?? null,
        changed: hits,
        tests,
      })),
    };
    console.log(JSON.stringify(payload, null, 2));
    return 0;
  }

  console.log(formatImpact(paths, matches).join("\n"));
  return 0;
}

const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();

if (isMain) {
  process.exitCode = await run();
}
