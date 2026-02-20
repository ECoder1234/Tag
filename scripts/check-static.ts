import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC_DIR = join(process.cwd(), "src");
const BANNED = ["alert(", "localStorage", "Math.random("];

const files: string[] = [];

const walk = (dir: string): void => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full);
      continue;
    }
    if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      files.push(full);
    }
  }
};

walk(SRC_DIR);

const violations: string[] = [];
for (const file of files) {
  const text = readFileSync(file, "utf8");
  for (const token of BANNED) {
    if (text.includes(token)) {
      violations.push(`${file}: contains ${token}`);
    }
  }
}

if (violations.length > 0) {
  process.stderr.write(`${violations.join("\n")}\n`);
  process.exit(1);
}
