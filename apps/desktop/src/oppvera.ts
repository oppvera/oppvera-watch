import { net } from "electron";
import { ingestBodyFromCaptures, type StoredCapture } from "./ingest.js";
import { normalizePairCode } from "./pairCode.js";
import type { DeviceRecord } from "./storage.js";

export type QueryBankItem = {
	query_item_id: string;
	text: string;
	category: string | null;
	expected_strength: string;
};

type ApiError = { detail?: string };

async function http(
	url: string,
	init: RequestInit = {},
): Promise<Response> {
	const fetchFn = net.fetch.bind(net) as typeof fetch;
	return fetchFn(url, init);
}

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
	return http(url, { ...init, headers });
}

async function readDetail(response: Response): Promise<string> {
	const text = await response.text();
	try {
		const payload = JSON.parse(text) as ApiError;
		if (payload.detail) return String(payload.detail);
	} catch {
		const snippet = text.replace(/\s+/g, " ").trim().slice(0, 120);
		if (snippet.startsWith("<")) {
			return `${response.status} from ${response.url} (HTML, not the probe API). Check the Oppvera base URL.`;
		}
		if (snippet) return `${response.status}: ${snippet}`;
	}
	return `${response.status} ${response.statusText || "error"} from the probe API`;
}

export async function pairDevice(input: {
	apiBase: string;
	code: string;
	label: string;
}): Promise<DeviceRecord> {
	const api_base =
		input.apiBase.trim().replace(/\/$/, "") || "https://oppvera.com";
	const code = normalizePairCode(input.code);
	if (code.length !== 8) {
		throw new Error(
			"Pairing code should be 8 characters (for example K7QM-2P9L).",
		);
	}
	const url = `${api_base}/api/probe/devices/pair`;
	console.log(`[watch] pairing POST ${url}`);
	let response: Response;
	try {
		response = await http(url, {
			method: "POST",
			headers: { "Content-Type": "application/json", Accept: "application/json" },
			body: JSON.stringify({
				code,
				label: input.label.trim() || "Oppvera Watch",
			}),
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Could not reach ${url}: ${message}`);
	}
	console.log(`[watch] pairing status ${response.status}`);
	if (!response.ok) {
		throw new Error(await readDetail(response));
	}
	const text = await response.text();
	let payload: {
		device_token: string;
		workspace_id: string;
		company_id: string | null;
		campaign_id: string;
		campaign_name: string;
		company_name: string;
		brand_domain: string;
		api_base?: string;
	};
	try {
		payload = JSON.parse(text);
	} catch {
		throw new Error(
			`Pairing returned ${response.status} but not JSON. Check the Oppvera base URL.`,
		);
	}
	if (!payload.device_token || !payload.campaign_id) {
		throw new Error("Pairing response was missing a device token.");
	}
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
