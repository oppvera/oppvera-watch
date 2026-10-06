import { cpSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dest = join(root, "dist", "renderer");
mkdirSync(dest, { recursive: true });
cpSync(join(root, "src", "renderer"), dest, { recursive: true });
await esbuild.build({
	entryPoints: [join(root, "src", "preload.ts")],
	bundle: true,
	format: "cjs",
	outfile: join(root, "dist", "preload.cjs"),
	platform: "node",
	external: ["electron"],
});
await esbuild.build({
	entryPoints: [join(root, "src", "runItemDisplay.ts")],
	bundle: true,
	format: "iife",
	globalName: "WatchRunItemDisplay",
	outfile: join(dest, "runItemDisplay.js"),
	platform: "browser",
});
