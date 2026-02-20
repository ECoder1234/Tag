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
  const npmExecPath = process.env.npm_execpath;
  const result =
    cmd === "npm" && typeof npmExecPath === "string" && npmExecPath.length > 0
      ? spawnSync(process.execPath, [npmExecPath, ...args], {
          stdio: "inherit"
        })
      : spawnSync(cmd, args, {
          stdio: "inherit",
          shell: process.platform === "win32"
        });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
