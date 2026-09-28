import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	assertNoSecretKeys,
	captureFromPromptResult,
	ingestBodyFromCaptures,
	WATCH_PROVIDER_LABELS,
} from "./ingest.ts";
import { normalizePairCode } from "./pairCode.ts";

describe("capture mapping", () => {
	it("maps a prompt result without cookies or favicon", () => {
		const stored = captureFromPromptResult({
			run_id: "run-1",
			provider: "chatgpt",
			query_item_id: "q_intro",
			question: "What is the best tool?",
			response: "A signed-in answer",
			campaign_id: "camp-1",
			campaign_name: "NASA",
			sources: [
				{
					title: "Docs",
					cited_text: "excerpt",
					url: "https://example.com/docs",
					domain: "example.com",
					favicon: "data:image/png;base64,abc",
				},
			],
		});
		assert.equal(stored.source, "watch");
		assert.equal(stored.provider_label, WATCH_PROVIDER_LABELS.chatgpt);
		assert.equal(stored.account_hint, null);
		assert.equal(stored.sync_status, "pending");
		assert.equal(stored.citations[0]?.title, "Docs");
		assert.equal(
			JSON.stringify(stored).includes("favicon"),
			false,
		);
		const signedOut = captureFromPromptResult({
			run_id: "run-1",
			provider: "chatgpt",
			query_item_id: "q_intro",
			question: "What is the best tool?",
			response: "A signed-out answer",
			sources: [],
			session: "signed-out",
			campaign_id: "camp-1",
		});
		assert.equal(signedOut.provider_label, "ChatGPT.com (signed-out)");
		const body = ingestBodyFromCaptures("run-1", [stored]);
		assert.equal(body.captures.length, 1);
		assert.equal(body.captures[0]?.client_capture_id, stored.client_capture_id);
		assert.equal(body.campaign_id, "camp-1");
		assert.equal(body.captures[0]?.campaign_id, "camp-1");
	});

	it("rejects cookie blobs", () => {
		assert.throws(
			() => assertNoSecretKeys({ cookies: [{ name: "sid" }] }),
			/cookies/,
		);
		assert.throws(
			() => assertNoSecretKeys({ nested: { storageState: {} } }),
			/storageState/,
		);
	});
});

describe("pairing code", () => {
	it("strips hyphens and unicode dashes", () => {
		assert.equal(normalizePairCode("PB5K-2F2E"), "PB5K2F2E");
		assert.equal(normalizePairCode("pb5k–2f2e"), "PB5K2F2E");
	});
});
