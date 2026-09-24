import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
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
import type { StoredCapture } from "./ingest.js";

const here = dirname(fileURLToPath(import.meta.url));

type RunItem = {
	provider: Provider;
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
	lastError: string | null;
	python: { ok: boolean; message: string };
};

let win: BrowserWindow | null = null;
let queries: QueryBankItem[] = [];
let runItems: RunItem[] = [];
let running = false;
let lastSyncAt: string | null = null;
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
	return {
		paired: Boolean(device),
		device: publicDevice(device),
		queries,
		providers: await providerCards(),
		runtimeProviders: PROVIDER_LIST.map((id) => ({
			id,
			connected: existsSync(getAuthSessionFile(AUTH_FOR[id])),
		})),
		runItems,
		running,
		pendingSync: pendingCaptures().length,
		lastSyncAt,
		lastError,
		python: { ok: python.ok, message: python.message },
	};
}

async function pushState(): Promise<AppState> {
	const state = await snapshot();
	win?.webContents.send("watch:state", state);
	return state;
}

function nodeBin(): string {
	return process.env.npm_node_execpath || "node";
}

function spawnNode(script: string, args: string[]) {
	return spawn(nodeBin(), [script, ...args], {
		cwd: join(here, ".."),
		env: {
			...process.env,
			WATCH_SUPPORT_ROOT: supportEnv().root,
		},
		stdio: ["ignore", "pipe", "pipe"],
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
			} else {
				match.sync_status = "failed";
				match.sync_error = result.status;
			}
			writeCapture(match);
		}
	}
	lastSyncAt = new Date().toISOString();
	lastError = null;
}

const createWindow = () => {
	win = new BrowserWindow({
		width: 980,
		height: 760,
		title: "Oppvera Watch",
		webPreferences: {
			preload: join(here, "preload.js"),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: false,
		},
	});
	void win.loadFile(join(here, "renderer", "index.html"));
};

app.setName("Oppvera Watch");

app.whenReady().then(async () => {
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
		try {
			const device = await pairDevice(payload);
			saveDevice(device);
			queries = await fetchQueryBank(device);
			lastError = null;
		} catch (error) {
			lastError = error instanceof Error ? error.message : String(error);
			throw error;
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
	await new Promise<void>((resolve, reject) => {
		const child = spawnNode(join(here, "auth-child.js"), [
			provider,
			dirs.authRoot,
			python.ok ? process.env.CAMOUFOX_PYTHON_BIN || "" : "",
		]);
		let stderr = "";
		child.stderr?.on("data", (chunk) => {
			stderr += String(chunk);
		});
		child.on("exit", (code) => {
			if (code === 0) resolve();
			else reject(new Error(stderr.trim() || `Auth exited ${code}`));
		});
	});
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

ipcMain.handle("watch:startRun", async (_event, providers: Provider[]) => {
	const device = readDevice();
	if (!device) throw new Error("Pair first.");
	if (queries.length === 0) {
		throw new Error("The campaign query bank is empty. Add questions in Oppvera.");
	}
	const selected = providers.filter((id) => PROVIDER_LIST.includes(id));
	if (selected.length === 0) {
		throw new Error("Select at least one connected provider.");
	}
	await refreshPython();
	if (!python.ok) throw new Error(python.message);
	running = true;
	const runId = randomUUID();
	runItems = selected.flatMap((provider) =>
		queries.map((query) => ({
			provider,
			query_item_id: query.query_item_id,
			question: query.text,
			status: "pending" as const,
		})),
	);
	await pushState();
	const dirs = supportEnv();
	try {
		for (const provider of selected) {
			const jobPath = join(dirs.root, `job-${provider}.json`);
			writeFileSync(
				jobPath,
				JSON.stringify({
					run_id: runId,
					provider,
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
				child.stdout?.on("data", (chunk) => {
					for (const line of String(chunk).split("\n")) {
						if (!line.trim()) continue;
						try {
							const event = JSON.parse(line) as {
								event: string;
								query_item_id?: string;
								provider?: Provider;
								status?: RunItem["status"];
								error?: string;
							};
							if (event.query_item_id && event.provider) {
								const item = runItems.find(
									(row) =>
										row.query_item_id === event.query_item_id &&
										row.provider === event.provider,
								);
								if (item && event.status) {
									item.status = event.status;
									item.error = event.error;
								}
							}
							void pushState();
						} catch {
							// ignore non-JSON logs
						}
					}
				});
				let stderr = "";
				child.stderr?.on("data", (chunk) => {
					stderr += String(chunk);
				});
				child.on("exit", (code) => {
					if (code === 0) resolve();
					else reject(new Error(stderr.trim() || `Capture exited ${code}`));
				});
			});
		}
		try {
			await syncPending();
		} catch (error) {
			lastError = error instanceof Error ? error.message : String(error);
		}
	} finally {
		running = false;
		await pushState();
	}
	return snapshot();
});
