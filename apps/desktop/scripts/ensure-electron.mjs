import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);
const electronDir = dirname(require.resolve("electron/package.json"));
const { downloadArtifact } = require(
	require.resolve("@electron/get", { paths: [electronDir] }),
);
const { version } = require(join(electronDir, "package.json"));

const distDir = join(electronDir, "dist");
const pathFile = join(electronDir, "path.txt");
const platform = process.env.npm_config_platform || process.platform;
const arch = process.env.npm_config_arch || process.arch;
const platformPath =
	platform === "darwin"
		? "Electron.app/Contents/MacOS/Electron"
		: platform === "win32"
			? "electron.exe"
			: "electron";
const frameworkPath = join(
	distDir,
	"Electron.app/Contents/Frameworks/Electron Framework.framework",
);

function isComplete() {
	if (!existsSync(join(distDir, platformPath))) return false;
	if (platform === "darwin" && !existsSync(frameworkPath)) return false;
	return true;
}

function writePathFile() {
	writeFileSync(pathFile, platformPath, "utf8");
}

async function main() {
	if (isComplete()) {
		writePathFile();
		return;
	}

	console.log("Downloading a complete Electron binary…");
	const zipPath = await downloadArtifact({
		version,
		artifactName: "electron",
		force: process.env.force_no_cache === "true",
		platform,
		arch,
	});

	rmSync(distDir, { recursive: true, force: true });
	mkdirSync(distDir, { recursive: true });

	const unzip = spawnSync("unzip", ["-o", zipPath, "-d", distDir], {
		stdio: "inherit",
	});
	if (unzip.status !== 0) {
		throw new Error(
			`unzip failed (${unzip.status ?? "signal"}). Install the macOS unzip tool or delete node_modules/electron and retry.`,
		);
	}

	if (!isComplete()) {
		throw new Error(
			"Electron is still incomplete after unzip (missing Frameworks).",
		);
	}
	writePathFile();
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
