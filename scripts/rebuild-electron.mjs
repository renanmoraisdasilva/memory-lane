import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const electronVersion = packageJson.devDependencies?.electron;

if (typeof electronVersion !== "string") {
  throw new Error("The electron devDependency is not pinned in package.json");
}

const betterSqliteDirectory = path.resolve("node_modules", "better-sqlite3");
const prebuildInstall = path.resolve("node_modules", "prebuild-install", "bin.js");

execFileSync(
  process.execPath,
  [prebuildInstall, "--runtime=electron", `--target=${electronVersion}`, "--arch=x64", "--verbose"],
  {
    cwd: betterSqliteDirectory,
    stdio: "inherit",
  },
);
