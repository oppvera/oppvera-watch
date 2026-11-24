import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { ensureSupportDirs } from "./paths.js";

const execFileAsync = promisify(execFile);
const UNIX_PYTHON_NAMES = ["python3.12", "python3.11", "python3.10", "python3"];
const FRAMEWORK_VERSIONS = ["3.12", "3.11", "3.10"];
const WINDOWS_PY_VERSIONS = ["3.14", "3.13", "3.12", "3.11", "3.10"];
const WINDOWS_FOLDER_VERSIONS = ["314", "313", "312", "311", "310"];
const WINDOWS_PYTHON_NAMES = [
	"python3.14",
	"python3.13",
	"python3.12",
	"python3.11",
	"python3.10",
	"python3",
	"python",
];

type PythonProbe = {
	bin: string;
	prefix: string[];
};

export type PythonStatus = {
	ok: boolean;
	pythonBin: string | null;
	message: string;
};

export type PythonSetupProgress = {
	step: number;
	total: number;
	label: string;
	detail?: string;
};

const SETUP_STEP_TOTAL = 4;

/** PyPI release we test against; pairs with a specific Firefox build via browser-pin.json. */
export const CAMOUFOX_PIP_SPEC = "camoufox==0.5.9";

function absoluteCandidates(): string[] {
	const home = homedir();
	const paths: string[] = [];
	for (const version of FRAMEWORK_VERSIONS) {
		paths.push(
			`/Library/Frameworks/Python.framework/Versions/${version}/bin/python3`,
		);
	}
	for (const name of UNIX_PYTHON_NAMES) {
		paths.push(`/usr/local/bin/${name}`, `/opt/homebrew/bin/${name}`);
	}
	paths.push(join(home, ".local/bin/python3"));
	return paths;
}

function windowsCandidates(): PythonProbe[] {
	const local =
		process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local");
	const programFiles = process.env.ProgramFiles || "C:\\Program Files";
	const programFilesX86 =
		process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
	const probes: PythonProbe[] = [];
	for (const version of WINDOWS_PY_VERSIONS) {
		probes.push({ bin: "py", prefix: [`-${version}`] });
	}
	for (const version of WINDOWS_FOLDER_VERSIONS) {
		const folder = `Python${version}`;
		probes.push(
			{
				bin: join(local, "Programs", "Python", folder, "python.exe"),
				prefix: [],
			},
			{ bin: join(programFiles, folder, "python.exe"), prefix: [] },
			{ bin: join(programFilesX86, folder, "python.exe"), prefix: [] },
		);
	}
	for (const name of WINDOWS_PYTHON_NAMES) {
		probes.push({ bin: name, prefix: [] });
	}
	return probes;
}

function versionIsSupported(stdout: string): boolean {
	const match = stdout.match(/(\d+)[,\s]+(\d+)/);
	if (!match) return false;
	const major = Number(match[1]);
	const minor = Number(match[2]);
	return major > 3 || (major === 3 && minor >= 10);
}

async function probePython(probe: PythonProbe): Promise<string | null> {
	try {
		const { stdout } = await execFileAsync(
			probe.bin,
			[
				...probe.prefix,
				"-c",
				"import sys; print(sys.version_info[:2]); print(sys.executable)",
			],
			{ timeout: 5_000, windowsHide: true },
		);
		if (!versionIsSupported(stdout)) return null;
		if (probe.prefix.length === 0) return probe.bin;
		const executable = stdout.trim().split(/\r?\n/).pop()?.trim() ?? "";
		return executable && existsSync(executable) ? executable : null;
	} catch {
		return null;
	}
}

async function canUse(candidate: string): Promise<boolean> {
	return (await probePython({ bin: candidate, prefix: [] })) !== null;
}

export async function findSystemPython(): Promise<string | null> {
	const candidates =
		process.platform === "win32"
			? windowsCandidates()
			: [
					...absoluteCandidates().map((bin) => ({ bin, prefix: [] })),
					...UNIX_PYTHON_NAMES.map((bin) => ({ bin, prefix: [] })),
				];
	for (const candidate of candidates) {
		const resolved = await probePython(candidate);
		if (resolved) return resolved;
	}
	return null;
}

/** Venv interpreter: `Scripts/python.exe` on Windows, `bin/python` on macOS and Linux. */
export function venvInterpreterPath(
	pythonVenv: string,
	platform: NodeJS.Platform = process.platform,
): string {
	if (platform === "win32") {
		return join(pythonVenv, "Scripts", "python.exe");
	}
	return join(pythonVenv, "bin", "python");
}

export function venvPython(): string {
	const { pythonVenv } = ensureSupportDirs();
	return venvInterpreterPath(pythonVenv);
}

/** Fetch the Firefox build stamped for this installed camoufox wheel (ignores shared cache channel). */
async function camoufoxPackageFetchSpecifier(
	pythonBin: string,
): Promise<string | null> {
	try {
		const { stdout } = await execFileAsync(
			pythonBin,
			[
				"-c",
				`from camoufox.browser_pin import load_pin
pin = load_pin()
if pin is None:
    raise SystemExit(1)
print(f"{pin.repo_name.lower()}/{pin.spec}")`,
			],
			{ timeout: 15_000, windowsHide: true },
		);
		const spec = stdout.trim().split("\n").pop()?.trim() ?? "";
		return spec.includes("/") ? spec : null;
	} catch {
		return null;
	}
}

async function camoufoxBrowserReady(pythonBin: string): Promise<boolean> {
	try {
		const { stdout } = await execFileAsync(
			pythonBin,
			[
				"-c",
				"from camoufox.pkgman import camoufox_path; print(camoufox_path(download_if_missing=False))",
			],
			{ timeout: 20_000, windowsHide: true },
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

/** Keep a short readable line from pip or camoufox. Progress bars with no words are dropped. */
export function pythonActivityLine(line: string): string | null {
	const clean = line
		.replace(/\u001b\[[0-9;]*m/g, "")
		.replace(/\s+/g, " ")
		.trim();
	if (!clean || !/[A-Za-z]/.test(clean)) return null;
	return clean.slice(0, 180);
}

function runStep(
	bin: string,
	args: string[],
	timeout: number,
	onLine?: (line: string) => void,
): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = spawn(bin, args, { windowsHide: true });
		let stderr = "";
		let buffer = "";
		let settled = false;
		let timedOut = false;
		const finish = (error?: Error) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			if (error) reject(error);
			else resolve();
		};
		const timer = setTimeout(() => {
			timedOut = true;
			child.kill();
		}, timeout);
		const consume = (chunk: Buffer | string, isErr: boolean) => {
			const text = String(chunk);
			if (isErr) stderr = (stderr + text).slice(-4000);
			buffer += text;
			const parts = buffer.split(/\r?\n|\r/);
			buffer = parts.pop() ?? "";
			for (const part of parts) onLine?.(part);
		};
		child.stdout?.on("data", (chunk) => consume(chunk, false));
		child.stderr?.on("data", (chunk) => consume(chunk, true));
		child.on("error", (error) => finish(error));
		child.on("close", (code) => {
			if (buffer.trim()) onLine?.(buffer);
			if (timedOut) {
				finish(
					new Error(`Timed out after ${Math.round(timeout / 1000)} seconds`),
				);
				return;
			}
			if (code === 0) {
				finish();
				return;
			}
			finish(
				new Error(
					[`exit ${code ?? "unknown"}`, stderr.trim()]
						.filter(Boolean)
						.join("\n")
						.slice(0, 2000),
				),
			);
		});
	});
}

export async function setupCamoufoxEnv(
	onProgress?: (progress: PythonSetupProgress) => void,
): Promise<PythonStatus> {
	onProgress?.({
		step: 0,
		total: SETUP_STEP_TOTAL,
		label: "Looking for Python",
	});
	const system = await findSystemPython();
	if (!system) {
		return pythonStatus();
	}
	const { pythonVenv } = ensureSupportDirs();
	let lastDetail = "";
	let lastDetailAt = 0;
	const report = (step: number, label: string, detail?: string) => {
		onProgress?.({
			step,
			total: SETUP_STEP_TOTAL,
			label,
			detail,
		});
	};
	const steps: Array<{
		label: string;
		timeout: number;
		bin: string;
		args: string[];
	}> = [
		{
			label: "Creating the Python environment",
			timeout: 60_000,
			bin: system,
			args: ["-m", "venv", pythonVenv],
		},
		{
			label: "Updating pip",
			timeout: 120_000,
			bin: "",
			args: ["-m", "pip", "install", "--upgrade", "pip"],
		},
		{
			label: "Installing Camoufox",
			timeout: 180_000,
			bin: "",
			args: ["-m", "pip", "install", CAMOUFOX_PIP_SPEC],
		},
		{
			label: "Downloading the Camoufox browser",
			timeout: 300_000,
			bin: "",
			args: ["-m", "camoufox", "fetch"],
		},
	];
	for (let index = 0; index < steps.length; index += 1) {
		const step = steps[index];
		if (!step) continue;
		const stepNumber = index + 1;
		const bin = step.bin || venvPython();
		let args = step.args;
		if (step.label === "Downloading the Camoufox browser") {
			const specifier = await camoufoxPackageFetchSpecifier(bin);
			args = specifier
				? ["-m", "camoufox", "fetch", specifier]
				: ["-m", "camoufox", "fetch"];
		}
		lastDetail = "";
		lastDetailAt = 0;
		report(stepNumber, step.label);
		await runStep(bin, args, step.timeout, (line) => {
			const detail = pythonActivityLine(line);
			if (!detail || detail === lastDetail) return;
			const now = Date.now();
			if (now - lastDetailAt < 300) return;
			lastDetail = detail;
			lastDetailAt = now;
			report(stepNumber, step.label, detail);
		});
	}
	return pythonStatus();
}
