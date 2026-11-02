import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	buildItemsForProviders,
	buildItemsForSlots,
	countFailedInManifest,
	failedSlotsFromManifest,
	filterBankByQueryIds,
	jobQueriesForProviderSession,
	resetFailedSlotsInManifest,
	type RunItemRecord,
} from "./runPlan.js";

const bank = [
	{
		query_item_id: "q1",
		text: "Question one",
		category: null,
		expected_strength: "medium",
	},
	{
		query_item_id: "q2",
		text: "Question two",
		category: null,
		expected_strength: "medium",
	},
];

const device = { campaign_id: "camp-a", campaign_name: "Alpha" };

describe("filterBankByQueryIds", () => {
	it("returns the full bank when ids are omitted", () => {
		assert.deepEqual(filterBankByQueryIds(bank, undefined), bank);
	});

	it("filters to selected ids", () => {
		assert.deepEqual(filterBankByQueryIds(bank, ["q2"]), [bank[1]]);
	});

	it("rejects an empty selection", () => {
		assert.throws(() => filterBankByQueryIds(bank, []), /Select at least one/);
	});
});

describe("failedSlotsFromManifest", () => {
	const items: RunItemRecord[] = [
		{
			...device,
			provider: "chatgpt",
			session: "signed-in",
			query_item_id: "q1",
			question: "Question one",
			status: "captured",
		},
		{
			...device,
			provider: "chatgpt",
			session: "signed-in",
			query_item_id: "q2",
			question: "Question two",
			status: "failed",
			error: "timeout",
		},
		{
			campaign_id: "other",
			campaign_name: "Other",
			provider: "claude",
			session: "signed-in",
			query_item_id: "q9",
			question: "Other",
			status: "failed",
		},
	];

	it("collects failed slots for one campaign", () => {
		assert.deepEqual(failedSlotsFromManifest(items, "camp-a"), [
			{
				query_item_id: "q2",
				provider: "chatgpt",
				session: "signed-in",
			},
		]);
		assert.equal(countFailedInManifest(items, "camp-a"), 1);
	});

	it("resets failed rows to pending", () => {
		const copy = structuredClone(items);
		const slots = failedSlotsFromManifest(copy, "camp-a");
		resetFailedSlotsInManifest(copy, slots, "camp-a");
		assert.equal(copy[1]?.status, "pending");
		assert.equal(copy[1]?.error, undefined);
		assert.equal(copy[0]?.status, "captured");
	});
});

describe("jobQueriesForProviderSession", () => {
	it("dedupes questions per provider job", () => {
		const items = buildItemsForProviders(device, bank, ["chatgpt", "claude"]);
		assert.equal(
			jobQueriesForProviderSession(items, "chatgpt", "signed-in", bank).length,
			2,
		);
	});

	it("builds slot items for partial retries", () => {
		const items = buildItemsForSlots(device, bank, [
			{ query_item_id: "q2", provider: "chatgpt", session: "signed-in" },
		]);
		assert.equal(items.length, 1);
		assert.equal(items[0]?.query_item_id, "q2");
	});
});
