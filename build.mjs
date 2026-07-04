// Cross-platform build: bundles src/app.jsx and copies public/* into dist/.
// Works the same on macOS, Windows, and Linux (no bash required).
import * as esbuild from "esbuild";
import { rmSync, mkdirSync, cpSync, readdirSync } from "node:fs";

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });

await esbuild.build({
  entryPoints: ["src/app.jsx"],
  bundle: true,
  minify: true,
  jsx: "automatic",
  outfile: "dist/app.js",
});

for (const f of readdirSync("public")) {
  cpSync(`public/${f}`, `dist/${f}`, { recursive: true });
}

console.log("Built dist/  — ready to serve or deploy.");
