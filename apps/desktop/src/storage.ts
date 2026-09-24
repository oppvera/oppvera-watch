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
import type { StoredCapture } from "./ingest.js";
import { ensureSupportDirs } from "./paths.js";

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

function writePrivate(path: string, contents: string): void {
	writeFileSync(path, contents, { encoding: "utf8", mode: 0o600 });
	chmodSync(path, 0o600);
}

export function readDevice(): DeviceRecord | null {
	const { deviceFile } = ensureSupportDirs();
	if (!existsSync(deviceFile)) return null;
	try {
		return JSON.parse(readFileSync(deviceFile, "utf8")) as DeviceRecord;
	} catch {
		return null;
	}
}

export function saveDevice(record: DeviceRecord): void {
	const { deviceFile } = ensureSupportDirs();
	writePrivate(deviceFile, `${JSON.stringify(record, null, 2)}\n`);
}

export function clearDevice(): void {
	const { deviceFile } = ensureSupportDirs();
	if (existsSync(deviceFile)) {
		rmSync(deviceFile, { force: true });
	}
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
