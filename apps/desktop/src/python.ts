import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { ensureSupportDirs } from "./paths.js";

const execFileAsync = promisify(execFile);
const PYTHON_CANDIDATES = ["python3.12", "python3.11", "python3.10", "python3"];

export type PythonStatus = {
	ok: boolean;
	pythonBin: string | null;
	message: string;
};

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
	for (const candidate of PYTHON_CANDIDATES) {
		if (await canUse(candidate)) return candidate;
	}
	return null;
}

export function venvPython(): string {
	const { pythonVenv } = ensureSupportDirs();
	return join(pythonVenv, "bin", "python");
}

export async function pythonStatus(): Promise<PythonStatus> {
	const venv = venvPython();
	if (existsSync(venv) && (await canUse(venv))) {
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
		message: "Python is installed. Create the Camoufox environment before connecting a provider.",
	};
}

export async function setupCamoufoxEnv(): Promise<PythonStatus> {
	const system = await findSystemPython();
	if (!system) {
		return pythonStatus();
	}
	const { pythonVenv } = ensureSupportDirs();
	await execFileAsync(system, ["-m", "venv", pythonVenv], { timeout: 60_000 });
	const python = venvPython();
	await execFileAsync(python, ["-m", "pip", "install", "--upgrade", "pip"], {
		timeout: 120_000,
	});
	await execFileAsync(python, ["-m", "pip", "install", "camoufox"], {
		timeout: 180_000,
	});
	return pythonStatus();
}
