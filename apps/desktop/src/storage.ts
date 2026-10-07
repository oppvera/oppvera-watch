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
	DEFAULT_WEEKLY_SCHEDULE,
	normalizeWeeklySchedule,
	type WeeklySchedulePrefs,
} from "./watchSchedule.js";

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
	lastRunProviders: Provider[];
};

export function clampMaxGroupSize(value: unknown): number {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return DEFAULT_MAX_GROUP_SIZE;
	return Math.min(
		ABSOLUTE_MAX_GROUP_SIZE,
		Math.max(DEFAULT_MAX_GROUP_SIZE, Math.round(parsed)),
	);
}

export function assertGroupSize(count: number, maxGroupSize: number): void {
	const max = clampMaxGroupSize(maxGroupSize);
	if (count < 1) {
		throw new Error("Select at least one campaign.");
	}
	if (count > max) {
		throw new Error(`A group run can include at most ${max} campaigns.`);
	}
}

function writePrivate(path: string, contents: string): void {
	writeFileSync(path, contents, { encoding: "utf8", mode: 0o600 });
	chmodSync(path, 0o600);
}

function defaultPrefs(): WatchPrefs {
	return {
		activeCampaignId: null,
		maxGroupSize: DEFAULT_MAX_GROUP_SIZE,
		weeklySchedule: { ...DEFAULT_WEEKLY_SCHEDULE },
		lastRunProviders: [],
	};
}

function readPrefsFile(): WatchPrefs {
	const { prefsFile } = ensureSupportDirs();
	if (!existsSync(prefsFile)) return defaultPrefs();
	try {
		const raw = JSON.parse(readFileSync(prefsFile, "utf8")) as Partial<WatchPrefs>;
		return {
			activeCampaignId: raw.activeCampaignId ?? null,
			maxGroupSize: clampMaxGroupSize(raw.maxGroupSize),
			weeklySchedule: normalizeWeeklySchedule(raw.weeklySchedule),
			lastRunProviders: Array.isArray(raw.lastRunProviders)
				? raw.lastRunProviders.filter((id): id is Provider => typeof id === "string")
				: [],
		};
	} catch {
		return defaultPrefs();
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
				lastRunProviders: prefs.lastRunProviders,
			},
			null,
			2,
		)}\n`,
	);
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
	const prefs = readPrefsFile();
	const devices = readDevicesFile();
	if (
		prefs.activeCampaignId &&
		devices.some((device) => device.campaign_id === prefs.activeCampaignId)
	) {
		return prefs;
	}
	const next = devices[0]?.campaign_id ?? null;
	if (next !== prefs.activeCampaignId) {
		const updated = { ...prefs, activeCampaignId: next };
		writePrefs(updated);
		return updated;
	}
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
	const prefs = readPrefsFile();
	writePrefs({ ...prefs, activeCampaignId: record.campaign_id });
}

export function setActiveCampaign(campaignId: string): void {
	if (!deviceByCampaign(campaignId)) {
		throw new Error("That campaign is not paired on this Mac.");
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

export function setWeeklySchedule(patch: Partial<WeeklySchedulePrefs>): WatchPrefs {
	const prefs = readPrefs();
	const next = {
		...prefs,
		weeklySchedule: normalizeWeeklySchedule({
			...prefs.weeklySchedule,
			...patch,
		}),
	};
	writePrefs(next);
	return next;
}

export function markWeeklyAutoRun(weekKey: string): WatchPrefs {
	return setWeeklySchedule({ lastAutoRunWeek: weekKey });
}

export function setLastRunProviders(providers: Provider[]): WatchPrefs {
	const prefs = readPrefs();
	const next = { ...prefs, lastRunProviders: providers };
	writePrefs(next);
	return next;
}

export function removeDevice(campaignId: string): void {
	const devices = listDevices().filter((device) => device.campaign_id !== campaignId);
	writeDevices(devices);
	const prefs = readPrefsFile();
	if (prefs.activeCampaignId === campaignId) {
		writePrefs({ ...prefs, activeCampaignId: devices[0]?.campaign_id ?? null });
	}
}

export function clearDevice(): void {
	migrateLegacyDevice();
	writeDevices([]);
	const prefs = readPrefsFile();
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
