import { mkdir, readFile, rm, writeFile, cp } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

interface RuntimeConfig {
  variant: "classic" | "infinity";
  theme: "classic" | "infinity";
  title: string;
  powerupsEnabled: boolean;
  skinsEnabled: boolean;
}

const INFINITY_CONFIG: RuntimeConfig = {
  variant: "infinity",
  theme: "infinity",
  title: "Tag Infinity",
  powerupsEnabled: true,
  skinsEnabled: true
};

const CLASSIC_CONFIG: RuntimeConfig = {
  variant: "classic",
  theme: "classic",
  title: "Multiplayer Quick Tag",
  powerupsEnabled: false,
  skinsEnabled: false
};

const writeJson = async (path: string, value: unknown): Promise<void> => {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const run = (command: string, args: string[], cwd: string): void => {
  const npmExecPath = process.env.npm_execpath;
  const result =
    command === "npm" && typeof npmExecPath === "string" && npmExecPath.length > 0
      ? spawnSync(process.execPath, [npmExecPath, ...args], {
          cwd,
          stdio: "inherit"
        })
      : spawnSync(command, args, {
          cwd,
          stdio: "inherit",
          shell: process.platform === "win32"
        });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
};

const main = async (): Promise<void> => {
  const projectRoot = process.cwd();
  const publicConfigPath = join(projectRoot, "public", "runtime-config.json");
  const distDir = join(projectRoot, "dist");
  const classicDir = resolve(projectRoot, "..", "fetch ga,e", "multiplayer-quick-tag-files");

  const previousConfig = await readFile(publicConfigPath, "utf8");
  await writeJson(publicConfigPath, INFINITY_CONFIG);

  try {
    run("npm", ["run", "build"], projectRoot);

    await rm(classicDir, { recursive: true, force: true });
    await mkdir(classicDir, { recursive: true });
    await cp(distDir, classicDir, { recursive: true });
    await writeJson(join(classicDir, "runtime-config.json"), CLASSIC_CONFIG);
  } finally {
    await writeFile(publicConfigPath, previousConfig, "utf8");
  }

  console.log("Synced variants:");
  console.log(`- Infinity: ${publicConfigPath}`);
  console.log(`- Classic:  ${join(classicDir, "runtime-config.json")}`);
};

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
