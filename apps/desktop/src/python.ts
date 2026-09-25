import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { ensureSupportDirs } from "./paths.js";

const execFileAsync = promisify(execFile);
const PYTHON_NAMES = ["python3.12", "python3.11", "python3.10", "python3"];
const FRAMEWORK_VERSIONS = ["3.12", "3.11", "3.10"];

export type PythonStatus = {
	ok: boolean;
	pythonBin: string | null;
	message: string;
};

function absoluteCandidates(): string[] {
	const home = homedir();
	const paths: string[] = [];
	for (const version of FRAMEWORK_VERSIONS) {
		paths.push(
			`/Library/Frameworks/Python.framework/Versions/${version}/bin/python3`,
		);
	}
	for (const name of PYTHON_NAMES) {
		paths.push(`/usr/local/bin/${name}`, `/opt/homebrew/bin/${name}`);
	}
	paths.push(join(home, ".local/bin/python3"));
	return paths;
}

async function canUse(candidate: string): Promise<boolean> {
	try {
		const { stdout } = await execFileAsync(
			candidate,
			["-c", "import sys; print(sys.version_info[:2])"],
			{ timeout: 5_000 },
		);
		const match = stdout.match(/(\d+),\s*(\d+)/);
		if (!match) return false;
		const major = Number(match[1]);
		const minor = Number(match[2]);
		return major > 3 || (major === 3 && minor >= 10);
	} catch {
		return false;
	}
}

export async function findSystemPython(): Promise<string | null> {
	for (const candidate of [...absoluteCandidates(), ...PYTHON_NAMES]) {
		if (await canUse(candidate)) return candidate;
	}
	return null;
}

export function venvPython(): string {
	const { pythonVenv } = ensureSupportDirs();
	return join(pythonVenv, "bin", "python");
}

async function camoufoxBrowserReady(pythonBin: string): Promise<boolean> {
	try {
		const { stdout } = await execFileAsync(
			pythonBin,
			[
				"-c",
				"from camoufox.pkgman import camoufox_path; print(camoufox_path(download_if_missing=False))",
			],
			{ timeout: 20_000 },
		);
		const path = stdout.trim().split("\n").pop()?.trim() ?? "";
		return path.length > 0 && existsSync(path);
	} catch {
		return false;
	}
}

export async function pythonStatus(): Promise<PythonStatus> {
	const venv = venvPython();
	if (
		existsSync(venv) &&
		(await canUse(venv)) &&
		(await camoufoxBrowserReady(venv))
	) {
		return {
			ok: true,
			pythonBin: venv,
			message: "Camoufox Python environment is ready.",
		};
	}
	const system = await findSystemPython();
	if (!system) {
		return {
			ok: false,
			pythonBin: null,
			message:
				"Install Python 3.12 from python.org, then relaunch Oppvera Watch. Docker is not required.",
		};
	}
	return {
		ok: false,
		pythonBin: system,
		message:
			"Python is installed. Use Set up Camoufox Python before connecting a provider.",
	};
}

async function runStep(
	bin: string,
	args: string[],
	timeout: number,
): Promise<void> {
	try {
		await execFileAsync(bin, args, { timeout });
	} catch (error) {
		const stderr =
			error && typeof error === "object" && "stderr" in error
				? String((error as { stderr?: unknown }).stderr ?? "")
				: "";
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(
			[message, stderr.trim()].filter(Boolean).join("\n").slice(0, 2000),
		);
	}
}

export async function setupCamoufoxEnv(): Promise<PythonStatus> {
	const system = await findSystemPython();
	if (!system) {
		return pythonStatus();
	}
	const { pythonVenv } = ensureSupportDirs();
	await runStep(system, ["-m", "venv", pythonVenv], 60_000);
	const python = venvPython();
	await runStep(python, ["-m", "pip", "install", "--upgrade", "pip"], 120_000);
	await runStep(python, ["-m", "pip", "install", "camoufox"], 180_000);
	await runStep(python, ["-m", "camoufox", "fetch"], 300_000);
	return pythonStatus();
}
