import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

const required = [
  "dist/index.html",
  "dist/assets",
  "public/generated/assets-manifest.json",
  "public/marketing/cover.svg"
];

const missing: string[] = [];
for (const rel of required) {
  const full = join(process.cwd(), rel);
  if (!existsSync(full)) {
    missing.push(rel);
    continue;
  }
  if (rel.endsWith("/assets") && !statSync(full).isDirectory()) {
    missing.push(rel);
  }
}

if (missing.length > 0) {
  process.stderr.write(`Missing release artifacts:\n${missing.join("\n")}\n`);
  process.exit(1);
}