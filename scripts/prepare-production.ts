import { spawnSync } from "node:child_process";

const steps = [
  ["npm", ["run", "generate-assets"]],
  ["npm", ["run", "generate-marketing"]],
  ["npm", ["run", "check-static"]],
  ["npm", ["run", "test"]],
  ["npm", ["run", "typecheck"]],
  ["npm", ["run", "build"]],
  ["npm", ["run", "verify-release"]]
] as const;

for (const [cmd, args] of steps) {
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: process.platform === "win32"
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}