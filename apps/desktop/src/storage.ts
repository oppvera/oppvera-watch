import { randomUUID } from "node:crypto";
import {
	chmodSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { Provider } from "@oneglanse/types";
import type { StoredCapture } from "./ingest.js";
import { ensureSupportDirs } from "./paths.js";
import {
	companyScheduleKey,
	DEFAULT_WEEKLY_SCHEDULE,
	normalizeRunSchedule,
	normalizeRunSchedules,
	normalizeWeeklySchedule,
	type RunSchedule,
	type WeeklySchedulePrefs,
} from "./watchSchedule.js";
import type { RunItemRecord } from "./runPlan.js";

export type LastRunManifest = {
	campaign_id: string;
	items: RunItemRecord[];
};

export type DeviceRecord = {
	device_token: string;
	api_base: string;
	workspace_id: string;
	company_id: string | null;
	campaign_id: string;
	campaign_name: string;
	company_name: string;
	brand_domain: string;
	paired_at: string;
};

export const DEFAULT_MAX_GROUP_SIZE = 2;
export const ABSOLUTE_MAX_GROUP_SIZE = 4;

export type WatchPrefs = {
	activeCampaignId: string | null;
	maxGroupSize: number;
	weeklySchedule: WeeklySchedulePrefs;
	schedules: RunSchedule[];
	lastRunProviders: Provider[];
	lastRunManifest: LastRunManifest | null;
};

export type RunScheduleInput = {
	id?: string;
	kind: RunSchedule["kind"];
	enabled: boolean;
	weekday: number;
	hour: number;
	companyIds: string[];
};

export function clampMaxGroupSize(value: unknown): number {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return DEFAULT_MAX_GROUP_SIZE;
	return Math.min(
		ABSOLUTE_MAX_GROUP_SIZE,
		Math.max(DEFAULT_MAX_GROUP_SIZE, Math.round(parsed)),
	);
}

export function assertGroupSize(count: number, _maxGroupSize?: number): void {
	if (count < 1) {
		throw new Error("Select at least one campaign.");
	}
}

function writePrivate(path: string, contents: string): void {
	writeFileSync(path, contents, { encoding: "utf8", mode: 0o600 });
	chmodSync(path, 0o600);
}

function normalizeLastRunManifest(
	raw: Partial<LastRunManifest> | null | undefined,
): LastRunManifest | null {
	if (!raw || typeof raw.campaign_id !== "string" || !raw.campaign_id.trim()) {
		return null;
	}
	if (!Array.isArray(raw.items) || raw.items.length === 0) return null;
	const items = raw.items.filter(
		(row): row is RunItemRecord =>
			Boolean(row) &&
			typeof row === "object" &&
			typeof row.campaign_id === "string" &&
			typeof row.query_item_id === "string" &&
			typeof row.provider === "string" &&
			typeof row.question === "string" &&
			(row.status === "pending" ||
				row.status === "running" ||
				row.status === "captured" ||
				row.status === "failed"),
	);
	if (items.length === 0) return null;
	return { campaign_id: raw.campaign_id.trim(), items };
}

type LoadedPrefs = WatchPrefs & { schedulesDefined: boolean };

function defaultPrefs(): WatchPrefs {
	return {
		activeCampaignId: null,
		maxGroupSize: DEFAULT_MAX_GROUP_SIZE,
		weeklySchedule: { ...DEFAULT_WEEKLY_SCHEDULE },
		schedules: [],
		lastRunProviders: [],
		lastRunManifest: null,
	};
}

function readPrefsFile(): LoadedPrefs {
	const { prefsFile } = ensureSupportDirs();
	if (!existsSync(prefsFile)) return { ...defaultPrefs(), schedulesDefined: true };
	try {
		const raw = JSON.parse(readFileSync(prefsFile, "utf8")) as Partial<WatchPrefs> & {
			schedules?: unknown;
		};
		const schedulesDefined = Array.isArray(raw.schedules);
		return {
			activeCampaignId: raw.activeCampaignId ?? null,
			maxGroupSize: clampMaxGroupSize(raw.maxGroupSize),
			weeklySchedule: normalizeWeeklySchedule(raw.weeklySchedule),
			schedules: schedulesDefined ? normalizeRunSchedules(raw.schedules) : [],
			schedulesDefined,
			lastRunProviders: Array.isArray(raw.lastRunProviders)
				? raw.lastRunProviders.filter((id): id is Provider => typeof id === "string")
				: [],
			lastRunManifest: normalizeLastRunManifest(raw.lastRunManifest),
		};
	} catch {
		return { ...defaultPrefs(), schedulesDefined: true };
	}
}

function writePrefs(prefs: WatchPrefs): void {
	const { prefsFile } = ensureSupportDirs();
	writePrivate(
		prefsFile,
		`${JSON.stringify(
			{
				activeCampaignId: prefs.activeCampaignId,
				maxGroupSize: clampMaxGroupSize(prefs.maxGroupSize),
				weeklySchedule: normalizeWeeklySchedule(prefs.weeklySchedule),
				schedules: normalizeRunSchedules(prefs.schedules),
				lastRunProviders: prefs.lastRunProviders,
				lastRunManifest: prefs.lastRunManifest,
			},
			null,
			2,
		)}\n`,
	);
}

function legacySchedulesFromWeekly(
	prefs: WatchPrefs,
	devices: DeviceRecord[],
): RunSchedule[] {
	if (!prefs.weeklySchedule.enabled) return [];
	const device =
		devices.find((row) => row.campaign_id === prefs.activeCampaignId) ??
		devices[0];
	if (!device) return [];
	const key = companyScheduleKey(device);
	const schedule = normalizeRunSchedule({
		id: `company:${key}`,
		kind: "company",
		enabled: true,
		weekday: prefs.weeklySchedule.weekday,
		hour: prefs.weeklySchedule.hour,
		companyIds: [key],
		lastAutoRunWeek: prefs.weeklySchedule.lastAutoRunWeek,
	});
	return schedule ? [schedule] : [];
}

function readDevicesFile(): DeviceRecord[] {
	const { devicesFile } = ensureSupportDirs();
	if (!existsSync(devicesFile)) return [];
	try {
		const raw = JSON.parse(readFileSync(devicesFile, "utf8")) as {
			devices?: DeviceRecord[];
		};
		return Array.isArray(raw.devices) ? raw.devices : [];
	} catch {
		return [];
	}
}

function writeDevices(devices: DeviceRecord[]): void {
	const { devicesFile } = ensureSupportDirs();
	writePrivate(devicesFile, `${JSON.stringify({ devices }, null, 2)}\n`);
}

function stampUntaggedCaptures(device: DeviceRecord): void {
	for (const capture of listCaptures()) {
		if (capture.campaign_id) continue;
		capture.campaign_id = device.campaign_id;
		capture.campaign_name = device.campaign_name;
		writeCapture(capture);
	}
}

function migrateLegacyDevice(): void {
	const dirs = ensureSupportDirs();
	if (existsSync(dirs.devicesFile)) return;
	if (!existsSync(dirs.deviceFile)) {
		writeDevices([]);
		if (!existsSync(dirs.prefsFile)) writePrefs(defaultPrefs());
		return;
	}
	let legacy: DeviceRecord | null = null;
	try {
		legacy = JSON.parse(readFileSync(dirs.deviceFile, "utf8")) as DeviceRecord;
	} catch {
		legacy = null;
	}
	if (!legacy?.campaign_id || !legacy.device_token) {
		writeDevices([]);
		if (!existsSync(dirs.prefsFile)) writePrefs(defaultPrefs());
		return;
	}
	writeDevices([legacy]);
	writePrefs({
		...defaultPrefs(),
		activeCampaignId: legacy.campaign_id,
	});
	stampUntaggedCaptures(legacy);
	rmSync(dirs.deviceFile, { force: true });
}

export function listDevices(): DeviceRecord[] {
	migrateLegacyDevice();
	return readDevicesFile();
}

export function readPrefs(): WatchPrefs {
	migrateLegacyDevice();
	const loaded = readPrefsFile();
	const devices = readDevicesFile();
	let prefs: WatchPrefs = {
		activeCampaignId: loaded.activeCampaignId,
		maxGroupSize: loaded.maxGroupSize,
		weeklySchedule: loaded.weeklySchedule,
		schedules: loaded.schedules,
		lastRunProviders: loaded.lastRunProviders,
		lastRunManifest: loaded.lastRunManifest,
	};
	let dirty = false;
	if (!loaded.schedulesDefined) {
		prefs = { ...prefs, schedules: legacySchedulesFromWeekly(prefs, devices) };
		dirty = true;
	}
	const activeOk =
		prefs.activeCampaignId &&
		devices.some((device) => device.campaign_id === prefs.activeCampaignId);
	if (!activeOk) {
		const next = devices[0]?.campaign_id ?? null;
		if (next !== prefs.activeCampaignId) {
			prefs = { ...prefs, activeCampaignId: next };
			dirty = true;
		}
	}
	if (dirty) writePrefs(prefs);
	return prefs;
}

export function readDevice(): DeviceRecord | null {
	const prefs = readPrefs();
	return (
		listDevices().find((device) => device.campaign_id === prefs.activeCampaignId) ??
		null
	);
}

export function deviceByCampaign(campaignId: string): DeviceRecord | null {
	return listDevices().find((device) => device.campaign_id === campaignId) ?? null;
}

export function saveDevice(record: DeviceRecord): void {
	const devices = listDevices().filter(
		(device) => device.campaign_id !== record.campaign_id,
	);
	devices.push(record);
	writeDevices(devices);
	const prefs = readPrefs();
	writePrefs({ ...prefs, activeCampaignId: record.campaign_id });
}

export function setActiveCampaign(campaignId: string): void {
	if (!deviceByCampaign(campaignId)) {
		throw new Error("That campaign is not paired on this computer.");
	}
	const prefs = readPrefs();
	writePrefs({ ...prefs, activeCampaignId: campaignId });
}

export function setMaxGroupSize(value: number): WatchPrefs {
	const prefs = readPrefs();
	const next = { ...prefs, maxGroupSize: clampMaxGroupSize(value) };
	writePrefs(next);
	return next;
}

export function saveRunSchedule(input: RunScheduleInput): WatchPrefs {
	const prefs = readPrefs();
	const companyIds = [
		...new Set(
			(input.companyIds || [])
				.map((id) => (typeof id === "string" ? id.trim() : ""))
				.filter(Boolean),
		),
	];
	if (companyIds.length === 0) {
		throw new Error("Choose at least one company.");
	}
	const kind = input.kind === "custom" ? "custom" : "company";
	const scopedIds = kind === "company" ? [companyIds[0]!] : companyIds;
	let id = input.id?.trim() || "";
	if (kind === "company") {
		id = `company:${scopedIds[0]}`;
	} else if (!id || id.startsWith("draft:") || !prefs.schedules.some((row) => row.id === id)) {
		id = `custom:${randomUUID()}`;
	}
	const existing = prefs.schedules.find((row) => row.id === id);
	const schedule = normalizeRunSchedule({
		id,
		kind,
		enabled: input.enabled,
		weekday: input.weekday,
		hour: input.hour,
		companyIds: scopedIds,
		lastAutoRunWeek: existing?.lastAutoRunWeek ?? null,
	});
	if (!schedule) throw new Error("Choose at least one company.");
	if (
		existing &&
		(existing.weekday !== schedule.weekday || existing.hour !== schedule.hour)
	) {
		schedule.lastAutoRunWeek = null;
	}
	const schedules = prefs.schedules.filter((row) => {
		if (row.id === id) return false;
		if (kind === "company" && row.kind === "company" && row.companyIds[0] === scopedIds[0]) {
			return false;
		}
		return true;
	});
	schedules.push(schedule);
	const next = { ...prefs, schedules };
	writePrefs(next);
	return next;
}

export function removeRunSchedule(id: string): WatchPrefs {
	const prefs = readPrefs();
	const next = {
		...prefs,
		schedules: prefs.schedules.filter((row) => row.id !== id),
	};
	writePrefs(next);
	return next;
}

export function markRunSchedules(ids: string[], weekKey: string): WatchPrefs {
	const marked = new Set(ids);
	const prefs = readPrefs();
	const next = {
		...prefs,
		schedules: prefs.schedules.map((row) =>
			marked.has(row.id) ? { ...row, lastAutoRunWeek: weekKey } : row,
		),
	};
	writePrefs(next);
	return next;
}

export function setLastRunProviders(providers: Provider[]): WatchPrefs {
	const prefs = readPrefs();
	const next = { ...prefs, lastRunProviders: providers };
	writePrefs(next);
	return next;
}

export function saveLastRunManifest(manifest: LastRunManifest | null): WatchPrefs {
	const prefs = readPrefs();
	const next = { ...prefs, lastRunManifest: manifest };
	writePrefs(next);
	return next;
}

export function removeDevice(campaignId: string): void {
	const devices = listDevices().filter((device) => device.campaign_id !== campaignId);
	writeDevices(devices);
	const prefs = readPrefs();
	if (prefs.activeCampaignId === campaignId) {
		writePrefs({ ...prefs, activeCampaignId: devices[0]?.campaign_id ?? null });
	}
}

export function clearDevice(): void {
	migrateLegacyDevice();
	writeDevices([]);
	const prefs = readPrefs();
	writePrefs({ ...prefs, activeCampaignId: null });
	const { deviceFile } = ensureSupportDirs();
	if (existsSync(deviceFile)) rmSync(deviceFile, { force: true });
}

export function capturePath(clientCaptureId: string): string {
	return join(ensureSupportDirs().capturesDir, `${clientCaptureId}.json`);
}

export function writeCapture(capture: StoredCapture): string {
	const path = capturePath(capture.client_capture_id);
	mkdirSync(ensureSupportDirs().capturesDir, { recursive: true });
	writePrivate(path, `${JSON.stringify(capture, null, 2)}\n`);
	return path;
}

export function readCapture(clientCaptureId: string): StoredCapture | null {
	const path = capturePath(clientCaptureId);
	if (!existsSync(path)) return null;
	return JSON.parse(readFileSync(path, "utf8")) as StoredCapture;
}

export function listCaptures(): StoredCapture[] {
	const { capturesDir } = ensureSupportDirs();
	if (!existsSync(capturesDir)) return [];
	return readdirSync(capturesDir)
		.filter((name) => name.endsWith(".json"))
		.map((name) => {
			try {
				return JSON.parse(
					readFileSync(join(capturesDir, name), "utf8"),
				) as StoredCapture;
			} catch {
				return null;
			}
		})
		.filter((row): row is StoredCapture => row !== null);
}

export function pendingCaptures(): StoredCapture[] {
	return listCaptures().filter((row) => row.sync_status !== "synced");
}
