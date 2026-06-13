import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsRoot = resolve(__dirname, "..");
const repoRoot = resolve(docsRoot, "../..");
const webRoot = resolve(repoRoot, "apps/web");
const outputPath = resolve(docsRoot, "api-reference/platform-openapi.json");

const result = spawnSync(
  "npm",
  ["run", "openapi:platform", "--", "--output", outputPath],
  {
    cwd: webRoot,
    stdio: "inherit",
  },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
