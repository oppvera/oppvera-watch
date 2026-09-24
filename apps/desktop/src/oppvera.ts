import { ingestBodyFromCaptures, type StoredCapture } from "./ingest.js";
import type { DeviceRecord } from "./storage.js";

export type QueryBankItem = {
	query_item_id: string;
	text: string;
	category: string | null;
	expected_strength: string;
};

type ApiError = { detail?: string };

async function probeFetch(
	device: DeviceRecord,
	path: string,
	init: RequestInit = {},
): Promise<Response> {
	const url = `${device.api_base.replace(/\/$/, "")}${path}`;
	const headers = new Headers(init.headers);
	headers.set("Authorization", `Bearer ${device.device_token}`);
	if (init.body && !headers.has("Content-Type")) {
		headers.set("Content-Type", "application/json");
	}
	return fetch(url, { ...init, headers });
}

async function readDetail(response: Response): Promise<string> {
	try {
		const payload = (await response.json()) as ApiError;
		if (payload.detail) return payload.detail;
	} catch {
		// ignore
	}
	return `${response.status} ${response.statusText}`;
}

export async function pairDevice(input: {
	apiBase: string;
	code: string;
	label: string;
}): Promise<DeviceRecord> {
	const api_base = input.apiBase.trim().replace(/\/$/, "") || "https://oppvera.com";
	const response = await fetch(`${api_base}/api/probe/devices/pair`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			code: input.code.trim(),
			label: input.label.trim() || "Oppvera Watch",
		}),
	});
	if (!response.ok) {
		throw new Error(await readDetail(response));
	}
	const payload = (await response.json()) as {
		device_token: string;
		workspace_id: string;
		company_id: string | null;
		campaign_id: string;
		campaign_name: string;
		company_name: string;
		brand_domain: string;
		api_base?: string;
	};
	return {
		device_token: payload.device_token,
		api_base: payload.api_base || api_base,
		workspace_id: payload.workspace_id,
		company_id: payload.company_id,
		campaign_id: payload.campaign_id,
		campaign_name: payload.campaign_name,
		company_name: payload.company_name,
		brand_domain: payload.brand_domain,
		paired_at: new Date().toISOString(),
	};
}

export async function fetchQueryBank(device: DeviceRecord): Promise<QueryBankItem[]> {
	const response = await probeFetch(
		device,
		`/api/probe/campaigns/${device.campaign_id}/query-bank`,
	);
	if (!response.ok) {
		throw new Error(await readDetail(response));
	}
	const payload = (await response.json()) as { queries?: QueryBankItem[] };
	return payload.queries ?? [];
}

export async function uploadCaptures(
	device: DeviceRecord,
	runId: string,
	captures: StoredCapture[],
): Promise<Array<{ client_capture_id: string; status: string; capture_id?: string }>> {
	if (captures.length === 0) return [];
	const response = await probeFetch(device, "/api/probe/captures", {
		method: "POST",
		body: JSON.stringify(ingestBodyFromCaptures(runId, captures)),
	});
	if (!response.ok) {
		throw new Error(await readDetail(response));
	}
	const payload = (await response.json()) as {
		results?: Array<{
			client_capture_id: string;
			status: string;
			capture_id?: string;
		}>;
	};
	return payload.results ?? [];
}
