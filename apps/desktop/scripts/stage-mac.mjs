import { execFileSync } from "node:child_process";
import { cpSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const desktop = join(dirname(fileURLToPath(import.meta.url)), "..");
const repo = join(desktop, "../..");
const stage = join(desktop, ".stage");

rmSync(stage, { recursive: true, force: true });

const pnpm = (args) => {
	execFileSync("pnpm", args, { cwd: repo, stdio: "inherit" });
};

pnpm([
	"--filter",
	"@oneglanse/types",
	"--filter",
	"@oneglanse/errors",
	"--filter",
	"@oneglanse/utils",
	"--filter",
	"@oneglanse/agent",
	"--filter",
	"@oppvera/watch-desktop",
	"build",
]);
pnpm(["--filter", "@oppvera/watch-desktop", "deploy", "--prod", stage]);
cpSync(join(desktop, "build"), join(stage, "build"), { recursive: true });

const builder = join(repo, "node_modules", ".bin", "electron-builder");
execFileSync(
	builder,
	[
		"--projectDir",
		stage,
		"--mac",
		"--arm64",
		`--config.directories.output=${join(desktop, "release")}`,
	],
	{ cwd: desktop, stdio: "inherit" },
);
