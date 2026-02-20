import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const required = [
  "dist/index.html",
  "dist/assets",
  "dist/runtime-config.json",
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

const distIndex = readFileSync(join(process.cwd(), "dist/index.html"), "utf8");
const requiredIndexTokens = ["og:title", "twitter:card", "crazygames-sdk-v3.js"];
const missingIndexTokens = requiredIndexTokens.filter((token) => !distIndex.includes(token));
if (missingIndexTokens.length > 0) {
  process.stderr.write(`dist/index.html missing publish metadata:\n${missingIndexTokens.join("\n")}\n`);
  process.exit(1);
}

interface RuntimeConfig {
  variant: "classic" | "infinity";
  theme: "classic" | "infinity";
  title: string;
  powerupsEnabled: boolean;
  skinsEnabled: boolean;
}

const runtimeConfig = JSON.parse(
  readFileSync(join(process.cwd(), "dist/runtime-config.json"), "utf8")
) as RuntimeConfig;
if (!runtimeConfig.title || runtimeConfig.title.trim().length === 0) {
  process.stderr.write("dist/runtime-config.json: title is empty\n");
  process.exit(1);
}

if (runtimeConfig.variant === "infinity" && (!runtimeConfig.powerupsEnabled || !runtimeConfig.skinsEnabled)) {
  process.stderr.write("dist/runtime-config.json: infinity variant must enable powerups and skins\n");
  process.exit(1);
}

const manifest = JSON.parse(
  readFileSync(join(process.cwd(), "public/generated/assets-manifest.json"), "utf8")
) as Record<string, unknown>;
if (!Array.isArray(manifest.atlases) || manifest.atlases.length === 0) {
  process.stderr.write("public/generated/assets-manifest.json: atlases is missing or empty\n");
  process.exit(1);
}
