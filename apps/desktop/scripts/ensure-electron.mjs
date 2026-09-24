import { existsSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);
const electronDir = dirname(require.resolve("electron/package.json"));
const pathFile = join(electronDir, "path.txt");
const platformPath =
	process.platform === "darwin"
		? "Electron.app/Contents/MacOS/Electron"
		: process.platform === "win32"
			? "electron.exe"
			: "electron";

function hasBinary() {
	return existsSync(join(electronDir, "dist", platformPath));
}

if (hasBinary()) {
	if (!existsSync(pathFile)) {
		writeFileSync(pathFile, platformPath);
	}
	process.exit(0);
}

console.log("Downloading the Electron binary (pnpm skipped its install script)…");
const result = spawnSync(process.execPath, [join(electronDir, "install.js")], {
	stdio: "inherit",
	cwd: electronDir,
	env: process.env,
});
if (hasBinary() && !existsSync(pathFile)) {
	writeFileSync(pathFile, platformPath);
}
if (!hasBinary() || !existsSync(pathFile)) {
	process.exit(result.status === null ? 1 : result.status || 1);
}
process.exit(0);
