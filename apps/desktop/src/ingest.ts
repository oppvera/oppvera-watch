import { randomUUID } from "node:crypto";
import type { Provider, Source } from "@oneglanse/types";

export type CaptureSession = "signed-in" | "signed-out";
export type SessionMode = CaptureSession | "both";

export const WATCH_PROVIDER_LABELS: Record<Provider, string> = {
	chatgpt: "ChatGPT.com (signed-in session)",
	claude: "Claude.ai (signed-in session)",
	gemini: "Gemini (signed-in session)",
	perplexity: "Perplexity (signed-in session)",
	"ai-overview": "Google AI Overview (signed-in Google session)",
};

export const WATCH_SIGNED_OUT_LABELS: Record<Provider, string> = {
	chatgpt: "ChatGPT.com (signed-out)",
	claude: "Claude.ai (signed-out)",
	gemini: "Gemini (signed-out)",
	perplexity: "Perplexity (signed-out)",
	"ai-overview": "Google AI Overview (signed-out)",
};

export function watchProviderLabel(
	provider: Provider,
	session: CaptureSession = "signed-in",
): string {
	return session === "signed-out"
		? WATCH_SIGNED_OUT_LABELS[provider]
		: WATCH_PROVIDER_LABELS[provider];
}

const FORBIDDEN_KEYS = new Set([
	"cookies",
	"storageState",
	"localStorage",
	"origins",
]);

export type WatchCitation = {
	title: string;
	cited_text: string;
	url: string;
	domain: string;
};

export type WatchCapturePayload = {
	client_capture_id: string;
	source: "watch";
	provider_id: Provider;
	provider_label: string;
	grounded: null;
	query_item_id: string;
	question: string;
	raw_answer: string;
	citations: WatchCitation[];
	captured_at: string;
	account_hint: null;
	campaign_id: string;
	campaign_name?: string;
};

export type StoredCapture = WatchCapturePayload & {
	run_id: string;
	sync_status: "pending" | "synced" | "failed";
	sync_error?: string;
	capture_id?: string;
};

export function assertNoSecretKeys(value: unknown, path = "$"): void {
	if (Array.isArray(value)) {
		value.forEach((item, index) => assertNoSecretKeys(item, `${path}[${index}]`));
		return;
	}
	if (!value || typeof value !== "object") {
		return;
	}
	for (const [key, nested] of Object.entries(value)) {
		if (FORBIDDEN_KEYS.has(key)) {
			throw new Error(`Refusing to store or upload ${key} at ${path}`);
		}
		assertNoSecretKeys(nested, `${path}.${key}`);
	}
}

export function citationsFromSources(sources: Source[]): WatchCitation[] {
	return sources.map((source) => ({
		title: source.title || "",
		cited_text: source.cited_text || "",
		url: source.url || "",
		domain: source.domain || "",
	}));
}

export function captureFromPromptResult(input: {
	run_id: string;
	provider: Provider;
	query_item_id: string;
	question: string;
	response: string;
	sources: Source[];
	session?: CaptureSession;
	captured_at?: string;
	campaign_id: string;
	campaign_name?: string;
}): StoredCapture {
	const session = input.session ?? "signed-in";
	const payload: StoredCapture = {
		client_capture_id: randomUUID(),
		run_id: input.run_id,
		source: "watch",
		provider_id: input.provider,
		provider_label: watchProviderLabel(input.provider, session),
		grounded: null,
		query_item_id: input.query_item_id,
		question: input.question,
		raw_answer: input.response.slice(0, 200_000),
		citations: citationsFromSources(input.sources),
		captured_at: input.captured_at ?? new Date().toISOString(),
		account_hint: null,
		campaign_id: input.campaign_id,
		campaign_name: input.campaign_name,
		sync_status: "pending",
	};
	assertNoSecretKeys(payload);
	return payload;
}

export function ingestBodyFromCaptures(runId: string, captures: StoredCapture[]) {
	const campaignIds = [
		...new Set(captures.map((capture) => capture.campaign_id).filter(Boolean)),
	];
	const body = {
		run_id: runId,
		campaign_id: campaignIds.length === 1 ? campaignIds[0] : undefined,
		captures: captures.map((capture) => ({
			client_capture_id: capture.client_capture_id,
			source: "watch" as const,
			campaign_id: capture.campaign_id,
			provider_id: capture.provider_id,
			provider_label: capture.provider_label,
			grounded: null,
			query_item_id: capture.query_item_id,
			question: capture.question,
			raw_answer: capture.raw_answer,
			citations: capture.citations,
			captured_at: capture.captured_at,
			account_hint: null,
		})),
	};
	assertNoSecretKeys(body);
	return body;
}
