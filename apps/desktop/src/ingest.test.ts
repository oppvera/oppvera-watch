import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	assertNoSecretKeys,
	captureFromPromptResult,
	ingestBodyFromCaptures,
	WATCH_PROVIDER_LABELS,
} from "./ingest.ts";

describe("capture mapping", () => {
	it("maps a prompt result without cookies or favicon", () => {
		const stored = captureFromPromptResult({
			run_id: "run-1",
			provider: "chatgpt",
			query_item_id: "q_intro",
			question: "What is the best tool?",
			response: "A signed-in answer",
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
		const body = ingestBodyFromCaptures("run-1", [stored]);
		assert.equal(body.captures.length, 1);
		assert.equal(body.captures[0]?.client_capture_id, stored.client_capture_id);
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
