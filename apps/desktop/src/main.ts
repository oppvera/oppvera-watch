import { randomUUID } from "node:crypto";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import {
	app,
	BrowserWindow,
	ipcMain,
} from "electron";
import type { AuthProvider, Provider } from "@oneglanse/types";
import {
	AUTH_PROVIDER_LIST,
	PROVIDER_LIST,
} from "@oneglanse/types";
import {
	getAuthSessionFile,
	readPersistedAuthStatus,
	resetProviderAuthData,
} from "@oneglanse/services/auth";
import type { QueryBankItem } from "./oppvera.js";
import { fetchQueryBank, pairDevice, uploadCaptures } from "./oppvera.js";
import { ensureSupportDirs } from "./paths.js";
import { pythonStatus, setupCamoufoxEnv } from "./python.js";
import { applyDesktopRuntimeEnv } from "./runtimeEnv.js";
import type { DeviceRecord } from "./storage.js";
import {
	clearDevice,
	pendingCaptures,
	readDevice,
	saveDevice,
	writeCapture,
} from "./storage.js";
import type { CaptureSession, StoredCapture } from "./ingest.js";
import {
	formatWatchVersionLabel,
	WATCH_VERSION,
} from "./version.js";

const here = dirname(fileURLToPath(import.meta.url));

type RunItem = {
	provider: Provider;
	session: CaptureSession;
	query_item_id: string;
	question: string;
	status: "pending" | "running" | "captured" | "failed";
	error?: string;
};

type AppState = {
	paired: boolean;
	device: Omit<DeviceRecord, "device_token"> | null;
	queries: QueryBankItem[];
	providers: Array<{
		id: AuthProvider;
		connected: boolean;
		error: string | null;
	}>;
	runtimeProviders: Array<{ id: Provider; connected: boolean }>;
	runItems: RunItem[];
	running: boolean;
	pendingSync: number;
	lastSyncAt: string | null;
	lastSyncUploaded: number | null;
	lastSyncFailed: number | null;
	lastError: string | null;
	python: { ok: boolean; message: string };
	appVersion: string;
	appVersionLabel: string;
};

let win: BrowserWindow | null = null;
let queries: QueryBankItem[] = [];
let runItems: RunItem[] = [];
let running = false;
let runCancelled = false;
let activeChild: ChildProcess | null = null;
let lastSyncAt: string | null = null;
let lastSyncUploaded: number | null = null;
let lastSyncFailed: number | null = null;
let lastError: string | null = null;
let python = {
	ok: false,
	message: "Checking Python…",
	pythonBin: null as string | null,
};

function supportEnv() {
	const dirs = ensureSupportDirs();
	process.env.WATCH_SUPPORT_ROOT = dirs.root;
	applyDesktopRuntimeEnv({
		authRoot: dirs.authRoot,
		pythonBin: process.env.CAMOUFOX_PYTHON_BIN,
	});
	return dirs;
}

function publicDevice(device: DeviceRecord | null) {
	if (!device) return null;
	const { device_token: _token, ...rest } = device;
	return rest;
}

async function providerCards() {
	supportEnv();
	const cards = [];
	for (const id of AUTH_PROVIDER_LIST) {
		const status = await readPersistedAuthStatus(id).catch(() => null);
		cards.push({
			id,
			connected: existsSync(getAuthSessionFile(id)),
			error: status?.error ?? null,
		});
	}
	return cards;
}

const AUTH_FOR: Record<Provider, AuthProvider> = {
	chatgpt: "chatgpt",
	perplexity: "perplexity",
	gemini: "gemini",
	"ai-overview": "google",
	claude: "claude",
};

async function snapshot(): Promise<AppState> {
	const device = readDevice();
	let providers: AppState["providers"] = AUTH_PROVIDER_LIST.map((id) => ({
		id,
		connected: false,
		error: null,
	}));
	try {
		providers = await providerCards();
	} catch (error) {
		console.error("[watch] provider status failed:", error);
	}
	return {
		paired: Boolean(device),
		device: publicDevice(device),
		queries,
		providers,
		runtimeProviders: PROVIDER_LIST.map((id) => ({
			id,
			connected: existsSync(getAuthSessionFile(AUTH_FOR[id])),
		})),
		runItems,
		running,
		pendingSync: pendingCaptures().length,
		lastSyncAt,
		lastSyncUploaded,
		lastSyncFailed,
		lastError,
		python: { ok: python.ok, message: python.message },
		appVersion: WATCH_VERSION.version,
		appVersionLabel: formatWatchVersionLabel(),
	};
}

async function pushState(): Promise<AppState> {
	const state = await snapshot();
	win?.webContents.send("watch:state", state);
	return state;
}

function isElectronBinary(bin: string): boolean {
	return /electron/i.test(bin) || /Oppvera Watch/i.test(bin);
}

function looksLikeNode(bin: string): boolean {
	const name = basename(bin).replace(/\.exe$/i, "").toLowerCase();
	return name === "node";
}

function childNodeBin(): string {
	const candidates = [
		process.env.npm_node_execpath,
		"/opt/homebrew/bin/node",
		"/usr/local/bin/node",
		"/usr/bin/node",
	].filter((value): value is string => Boolean(value));
	for (const candidate of candidates) {
		if (
			existsSync(candidate) &&
			looksLikeNode(candidate) &&
			!isElectronBinary(candidate)
		) {
			return candidate;
		}
	}
	return process.execPath;
}

function childEnv(bin: string): NodeJS.ProcessEnv {
	const env = { ...process.env };
	// Electron injects these into GUI children. Real Node and Firefox abort
	// immediately (exit 243) if DYLD_INSERT_LIBRARIES still points at Electron.
	delete env.DYLD_INSERT_LIBRARIES;
	delete env.DYLD_LIBRARY_PATH;
	delete env.LD_PRELOAD;
	delete env.LD_LIBRARY_PATH;
	delete env.CHROME_CRASHPAD_PIPE_NAME;
	delete env.ELECTRON_NO_ASAR;
	delete env.ELECTRON_NO_ATTACH_CONSOLE;
	if (isElectronBinary(bin)) {
		env.ELECTRON_RUN_AS_NODE = "1";
	} else {
		delete env.ELECTRON_RUN_AS_NODE;
	}
	env.WATCH_SUPPORT_ROOT = supportEnv().root;
	const pathParts = [
		env.PATH,
		"/opt/homebrew/bin",
		"/usr/local/bin",
		"/usr/bin",
		"/bin",
	].filter(Boolean);
	env.PATH = [...new Set(pathParts.join(":").split(":"))].join(":");
	return env;
}

function spawnNode(script: string, args: string[]) {
	const bin = childNodeBin();
	console.log("[watch] spawn", bin, script, args.join(" "));
	return spawn(bin, [script, ...args], {
		cwd: join(here, ".."),
		env: childEnv(bin),
		stdio: ["ignore", "pipe", "pipe"],
		detached: process.platform !== "win32",
	});
}

function killProcessTree(child: ChildProcess | null): void {
	if (!child?.pid || child.killed) return;
	const pid = child.pid;
	console.log("[watch] stopping child", pid);
	if (process.platform === "win32") {
		spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], {
			stdio: "ignore",
		});
		return;
	}
	try {
		process.kill(-pid, "SIGTERM");
	} catch {
		child.kill("SIGTERM");
	}
}

function waitForChild(
	child: ReturnType<typeof spawn>,
	label: string,
): Promise<void> {
	return new Promise((resolve, reject) => {
		let stdout = "";
		let stderr = "";
		child.stdout?.on("data", (chunk) => {
			const text = String(chunk);
			stdout += text;
			console.log(`[watch ${label}]`, text.trimEnd());
		});
		child.stderr?.on("data", (chunk) => {
			const text = String(chunk);
			stderr += text;
			console.error(`[watch ${label}]`, text.trimEnd());
		});
		child.on("error", (error) => {
			reject(new Error(`Could not start ${label}: ${error.message}`));
		});
		child.on("exit", (code, signal) => {
			if (code === 0) {
				resolve();
				return;
			}
			const detail =
				(stderr.trim() || stdout.trim()) ||
				`${label} exited ${code ?? "null"}${signal ? ` (${signal})` : ""}`;
			reject(new Error(detail));
		});
	});
}

async function refreshPython(): Promise<void> {
	python = await pythonStatus();
	if (python.pythonBin) {
		process.env.CAMOUFOX_PYTHON_BIN = python.pythonBin;
	}
}

async function syncPending(): Promise<void> {
	const device = readDevice();
	if (!device) throw new Error("Pair Oppvera Watch before syncing.");
	const pending = pendingCaptures();
	const byRun = new Map<string, StoredCapture[]>();
	for (const capture of pending) {
		const list = byRun.get(capture.run_id) ?? [];
		list.push(capture);
		byRun.set(capture.run_id, list);
	}
	let uploaded = 0;
	let failed = 0;
	for (const [runId, captures] of byRun) {
		const chunk = captures.slice(0, 50);
		const results = await uploadCaptures(device, runId, chunk);
		for (const result of results) {
			const match = chunk.find(
				(row) => row.client_capture_id === result.client_capture_id,
			);
			if (!match) continue;
			if (result.status === "created" || result.status === "exists") {
				match.sync_status = "synced";
				match.capture_id = result.capture_id;
				uploaded += 1;
			} else {
				match.sync_status = "failed";
				match.sync_error = result.status;
				failed += 1;
			}
			writeCapture(match);
		}
	}
	lastSyncAt = new Date().toISOString();
	lastSyncUploaded = pending.length === 0 ? 0 : uploaded;
	lastSyncFailed = pending.length === 0 ? 0 : failed;
	lastError = null;
}

const createWindow = () => {
	const preloadPath = join(here, "preload.cjs");
	console.log("[watch] preload path", preloadPath, "exists", existsSync(preloadPath));
	win = new BrowserWindow({
		width: 980,
		height: 760,
		title: "Oppvera Watch",
		webPreferences: {
			preload: preloadPath,
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: false,
		},
	});
	win.webContents.on("preload-error", (_event, path, error) => {
		console.error("[watch] preload-error", path, error);
	});
	win.webContents.on("console-message", (_event, _level, message) => {
		console.log("[watch renderer]", message);
	});
	win.webContents.on("did-fail-load", (_event, code, desc, url) => {
		console.error("[watch] did-fail-load", code, desc, url);
	});
	if (!app.isPackaged) {
		win.webContents.openDevTools({ mode: "bottom" });
	}
	void win.loadFile(join(here, "renderer", "index.html"));
};

app.setName("Oppvera Watch");

app.whenReady().then(async () => {
	app.setAboutPanelOptions({
		applicationName: WATCH_VERSION.productName,
		applicationVersion: WATCH_VERSION.version,
		version: WATCH_VERSION.version,
	});
	supportEnv();
	await refreshPython();
	const device = readDevice();
	if (device) {
		try {
			queries = await fetchQueryBank(device);
		} catch (error) {
			lastError = error instanceof Error ? error.message : String(error);
		}
	}
	createWindow();
});

ipcMain.handle("watch:getState", () => snapshot());

ipcMain.handle(
	"watch:pair",
	async (_event, payload: { apiBase: string; code: string; label: string }) => {
		console.log("[watch] pair IPC", payload?.apiBase, "code length", payload?.code?.length ?? 0);
		try {
			const device = await pairDevice(payload);
			saveDevice(device);
			try {
				queries = await fetchQueryBank(device);
				lastError = null;
			} catch (error) {
				queries = [];
				lastError =
					error instanceof Error
						? `Paired, but query bank failed: ${error.message}`
						: String(error);
			}
		} catch (error) {
			lastError = error instanceof Error ? error.message : String(error);
			console.error("[watch] pair failed:", lastError);
		}
		return pushState();
	},
);

ipcMain.handle("watch:unpair", async () => {
	clearDevice();
	queries = [];
	return pushState();
});

ipcMain.handle("watch:refreshBank", async () => {
	const device = readDevice();
	if (!device) throw new Error("Pair first.");
	queries = await fetchQueryBank(device);
	lastError = null;
	return pushState();
});

ipcMain.handle("watch:connectProvider", async (_event, provider: AuthProvider) => {
	if (!AUTH_PROVIDER_LIST.includes(provider)) {
		throw new Error("Unknown provider");
	}
	await refreshPython();
	if (!python.ok) {
		throw new Error(python.message);
	}
	const dirs = supportEnv();
	try {
		await waitForChild(
			spawnNode(join(here, "auth-child.js"), [
				provider,
				dirs.authRoot,
				python.ok ? process.env.CAMOUFOX_PYTHON_BIN || "" : "",
			]),
			`auth:${provider}`,
		);
		lastError = null;
	} catch (error) {
		lastError = error instanceof Error ? error.message : String(error);
		throw error;
	}
	return pushState();
});

ipcMain.handle("watch:resetProvider", async (_event, provider: AuthProvider) => {
	supportEnv();
	await resetProviderAuthData(provider);
	return pushState();
});

ipcMain.handle("watch:setupPython", async () => {
	python = await setupCamoufoxEnv();
	if (python.pythonBin) process.env.CAMOUFOX_PYTHON_BIN = python.pythonBin;
	return pushState();
});

ipcMain.handle("watch:syncNow", async () => {
	try {
		await syncPending();
	} catch (error) {
		lastError = error instanceof Error ? error.message : String(error);
		throw error;
	}
	return pushState();
});

ipcMain.handle(
	"watch:startRun",
	async (
		_event,
		payload: { providers: Provider[] } | Provider[],
	) => {
	const device = readDevice();
	if (!device) throw new Error("Pair first.");
	if (queries.length === 0) {
		throw new Error("The campaign query bank is empty. Add questions in Oppvera.");
	}
	const providers = Array.isArray(payload) ? payload : payload.providers;
	const selected = providers.filter((id) => PROVIDER_LIST.includes(id));
	if (selected.length === 0) {
		throw new Error("Select at least one provider.");
	}
	await refreshPython();
	if (!python.ok) throw new Error(python.message);
	const connected = (id: Provider) =>
		existsSync(getAuthSessionFile(AUTH_FOR[id]));
	const missing = selected.filter((id) => !connected(id));
	if (missing.length > 0) {
		throw new Error(
			`Connect ${missing.join(", ")} on the Providers tab before running.`,
		);
	}
	running = true;
	runCancelled = false;
	const runId = randomUUID();
	runItems = selected.flatMap((provider) =>
		queries.map((query) => ({
			provider,
			session: "signed-in" as const,
			query_item_id: query.query_item_id,
			question: query.text,
			status: "pending" as const,
		})),
	);
	if (runItems.length === 0) {
		running = false;
		throw new Error("Nothing to run. Connect a provider, then select it here.");
	}
	await pushState();
	const dirs = supportEnv();
	const jobs = [
		...new Map(
			runItems.map((item) => [
				`${item.provider}:${item.session}`,
				{ provider: item.provider, session: item.session },
			]),
		).values(),
	];
	try {
		for (const job of jobs) {
			if (runCancelled) break;
			const jobPath = join(dirs.root, `job-${job.provider}-${job.session}.json`);
			writeFileSync(
				jobPath,
				JSON.stringify({
					run_id: runId,
					provider: job.provider,
					session: job.session,
					queries: queries.map((query) => ({
						query_item_id: query.query_item_id,
						text: query.text,
					})),
					authRoot: dirs.authRoot,
					pythonBin: process.env.CAMOUFOX_PYTHON_BIN || null,
				}),
			);
			await new Promise<void>((resolve, reject) => {
				const child = spawnNode(join(here, "capture.js"), [jobPath]);
				activeChild = child;
				let leftover = "";
				child.stdout?.on("data", (chunk) => {
					for (const line of String(chunk).split("\n")) {
						if (!line.trim()) continue;
						try {
							const event = JSON.parse(line) as {
								event: string;
								query_item_id?: string;
								provider?: Provider;
								session?: CaptureSession;
								status?: RunItem["status"];
								error?: string;
							};
							if (event.query_item_id && event.provider) {
								const item = runItems.find(
									(row) =>
										row.query_item_id === event.query_item_id &&
										row.provider === event.provider &&
										row.session === (event.session || job.session),
								);
								if (item && event.status) {
									item.status = event.status;
									item.error = event.error;
								}
							}
							void pushState();
						} catch {
							leftover += `${line}\n`;
							console.log("[watch capture]", line);
						}
					}
				});
				let stderr = "";
				child.stderr?.on("data", (chunk) => {
					stderr += String(chunk);
					console.error("[watch capture]", String(chunk).trimEnd());
				});
				child.on("error", (error) => {
					if (activeChild === child) activeChild = null;
					reject(new Error(`Could not start capture: ${error.message}`));
				});
				child.on("exit", (code) => {
					if (activeChild === child) activeChild = null;
					if (runCancelled || code === 0) {
						resolve();
						return;
					}
					reject(
						new Error(
							(stderr.trim() || leftover.trim()) ||
								`Capture exited ${code}`,
						),
					);
				});
			});
		}
		if (runCancelled) {
			for (const item of runItems) {
				if (item.status === "pending" || item.status === "running") {
					item.status = "failed";
					item.error = "Stopped";
				}
			}
			lastError = "Run stopped.";
		} else {
			try {
				await syncPending();
			} catch (error) {
				lastError = error instanceof Error ? error.message : String(error);
			}
		}
	} finally {
		activeChild = null;
		running = false;
		runCancelled = false;
		await pushState();
	}
	return snapshot();
});

ipcMain.handle("watch:stopRun", async () => {
	if (!running) return snapshot();
	runCancelled = true;
	killProcessTree(activeChild);
	return pushState();
});
