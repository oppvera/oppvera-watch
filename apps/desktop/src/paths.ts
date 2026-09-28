import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const APP_FOLDER_NAME = "Oppvera Watch";

export function supportRoot(): string {
	if (process.env.WATCH_SUPPORT_ROOT?.trim()) {
		return process.env.WATCH_SUPPORT_ROOT.trim();
	}
	if (process.platform === "darwin") {
		return join(homedir(), "Library", "Application Support", APP_FOLDER_NAME);
	}
	if (process.platform === "win32") {
		return join(
			process.env.APPDATA || join(homedir(), "AppData", "Roaming"),
			APP_FOLDER_NAME,
		);
	}
	return join(homedir(), ".config", APP_FOLDER_NAME);
}

export function ensureSupportDirs(): {
	root: string;
	authRoot: string;
	capturesDir: string;
	pythonVenv: string;
	deviceFile: string;
	devicesFile: string;
	prefsFile: string;
} {
	const root = supportRoot();
	const authRoot = join(root, "auth");
	const capturesDir = join(root, "captures");
	const pythonVenv = join(root, "python-venv");
	mkdirSync(authRoot, { recursive: true });
	mkdirSync(capturesDir, { recursive: true });
	mkdirSync(pythonVenv, { recursive: true });
	return {
		root,
		authRoot,
		capturesDir,
		pythonVenv,
		deviceFile: join(root, "device.json"),
		devicesFile: join(root, "devices.json"),
		prefsFile: join(root, "watch.json"),
	};
}
