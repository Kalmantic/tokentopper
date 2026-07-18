import { rmSync } from "node:fs";
import { resolve } from "node:path";

import { build } from "esbuild";

const root = resolve(import.meta.dirname, "..");
const outdir = resolve(root, "dist");

rmSync(outdir, { recursive: true, force: true });
await build({
  entryPoints: [resolve(root, "src/cli.ts")],
  outfile: resolve(outdir, "cli.js"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: false,
  legalComments: "none",
});

console.log("built dist/cli.js for Node.js 22+");
