import { cpSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dest = join(root, "dist", "renderer");
mkdirSync(dest, { recursive: true });
cpSync(join(root, "src", "renderer"), dest, { recursive: true });
cpSync(join(root, "src", "preload.cjs"), join(root, "dist", "preload.cjs"));
await esbuild.build({
	entryPoints: [join(root, "src", "runItemDisplay.ts")],
	bundle: true,
	format: "iife",
	globalName: "WatchRunItemDisplay",
	outfile: join(dest, "runItemDisplay.js"),
	platform: "browser",
});
