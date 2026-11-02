import type { Provider } from "@oneglanse/types";
import type { CaptureSession } from "./ingest.js";
import type { QueryBankItem } from "./oppvera.js";

export type RunItemStatus = "pending" | "running" | "captured" | "failed";

export type RunItemRecord = {
	campaign_id: string;
	campaign_name: string;
	provider: Provider;
	session: CaptureSession;
	query_item_id: string;
	question: string;
	status: RunItemStatus;
	error?: string;
};

export type RunSlot = {
	query_item_id: string;
	provider: Provider;
	session: CaptureSession;
};

export function filterBankByQueryIds(
	bank: QueryBankItem[],
	queryItemIds: string[] | undefined,
): QueryBankItem[] {
	if (!queryItemIds) return bank;
	const allow = new Set(queryItemIds.filter(Boolean));
	if (allow.size === 0) {
		throw new Error("Select at least one question.");
	}
	const filtered = bank.filter((row) => allow.has(row.query_item_id));
	if (filtered.length === 0) {
		throw new Error("Selected questions are not in the current query bank.");
	}
	const missing = [...allow].filter(
		(id) => !bank.some((row) => row.query_item_id === id),
	);
	if (missing.length > 0) {
		throw new Error("Selected questions are not in the current query bank.");
	}
	return filtered;
}

export function buildItemsForProviders(
	device: { campaign_id: string; campaign_name: string },
	bank: QueryBankItem[],
	providers: Provider[],
): RunItemRecord[] {
	return providers.flatMap((provider) =>
		bank.map((query) => ({
			campaign_id: device.campaign_id,
			campaign_name: device.campaign_name,
			provider,
			session: "signed-in" as const,
			query_item_id: query.query_item_id,
			question: query.text,
			status: "pending" as const,
		})),
	);
}

export function buildItemsForSlots(
	device: { campaign_id: string; campaign_name: string },
	bank: QueryBankItem[],
	slots: RunSlot[],
): RunItemRecord[] {
	const byId = new Map(bank.map((row) => [row.query_item_id, row]));
	return slots.map((slot) => {
		const query = byId.get(slot.query_item_id);
		if (!query) {
			throw new Error(
				`Question ${slot.query_item_id} is not in the current query bank.`,
			);
		}
		return {
			campaign_id: device.campaign_id,
			campaign_name: device.campaign_name,
			provider: slot.provider,
			session: slot.session,
			query_item_id: slot.query_item_id,
			question: query.text,
			status: "pending" as const,
		};
	});
}

export function failedSlotsFromManifest(
	items: RunItemRecord[],
	campaignId: string,
): RunSlot[] {
	return items
		.filter(
			(row) => row.campaign_id === campaignId && row.status === "failed",
		)
		.map((row) => ({
			query_item_id: row.query_item_id,
			provider: row.provider,
			session: row.session,
		}));
}

export function countFailedInManifest(
	items: RunItemRecord[],
	campaignId: string,
): number {
	return items.filter(
		(row) => row.campaign_id === campaignId && row.status === "failed",
	).length;
}

export function resetFailedSlotsInManifest(
	items: RunItemRecord[],
	slots: RunSlot[],
	campaignId: string,
): void {
	for (const slot of slots) {
		const row = items.find(
			(item) =>
				item.campaign_id === campaignId &&
				item.query_item_id === slot.query_item_id &&
				item.provider === slot.provider &&
				item.session === slot.session,
		);
		if (!row) continue;
		row.status = "pending";
		row.error = undefined;
	}
}

export type CaptureJobQueries = Array<{ query_item_id: string; text: string }>;

export function jobQueriesForProviderSession(
	items: RunItemRecord[],
	provider: Provider,
	session: CaptureSession,
	bank: QueryBankItem[],
): CaptureJobQueries {
	const byId = new Map(bank.map((row) => [row.query_item_id, row]));
	const seen = new Set<string>();
	const queries: CaptureJobQueries = [];
	for (const item of items) {
		if (item.provider !== provider || item.session !== session) continue;
		if (seen.has(item.query_item_id)) continue;
		seen.add(item.query_item_id);
		const row = byId.get(item.query_item_id);
		if (!row) continue;
		queries.push({ query_item_id: row.query_item_id, text: row.text });
	}
	return queries;
}
