import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outDir = join(process.cwd(), "public", "marketing");
mkdirSync(outDir, { recursive: true });

const svg = [
  "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1200\" height=\"628\">",
  "<rect width=\"1200\" height=\"628\" fill=\"#0b1330\" />",
  "<text x=\"600\" y=\"280\" font-size=\"92\" fill=\"#7fffd4\" font-family=\"Arial\" text-anchor=\"middle\">Tag Infinity</text>",
  "<text x=\"600\" y=\"360\" font-size=\"38\" fill=\"#d3e9ff\" font-family=\"Arial\" text-anchor=\"middle\">Local Multiplayer Platform Tag</text>",
  "</svg>"
].join("");

writeFileSync(join(outDir, "cover.svg"), svg);