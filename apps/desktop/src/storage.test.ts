import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
	assertGroupSize,
	clampMaxGroupSize,
	clearDevice,
	listDevices,
	readDevice,
	readPrefs,
	saveDevice,
	setActiveCampaign,
	setMaxGroupSize,
	listCaptures,
} from "./storage.ts";

function sampleDevice(campaignId: string, name: string) {
	return {
		device_token: `token-${campaignId}`,
		api_base: "https://oppvera.com",
		workspace_id: "ws-1",
		company_id: "co-1",
		campaign_id: campaignId,
		campaign_name: name,
		company_name: "Acme",
		brand_domain: "acme.example",
		paired_at: "2026-09-28T00:00:00.000Z",
	};
}

describe("group size", () => {
	it("clamps to 2–4", () => {
		assert.equal(clampMaxGroupSize(1), 2);
		assert.equal(clampMaxGroupSize(2), 2);
		assert.equal(clampMaxGroupSize(4), 4);
		assert.equal(clampMaxGroupSize(9), 4);
		assert.equal(clampMaxGroupSize("nope"), 2);
	});

	it("rejects empty or oversized group runs", () => {
		assert.throws(() => assertGroupSize(0, 2), /at least one/);
		assert.throws(() => assertGroupSize(3, 2), /at most 2/);
		assert.doesNotThrow(() => assertGroupSize(2, 2));
	});
});

describe("device store", () => {
	let root = "";

	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), "oppvera-watch-"));
		process.env.WATCH_SUPPORT_ROOT = root;
	});

	afterEach(() => {
		rmSync(root, { recursive: true, force: true });
		delete process.env.WATCH_SUPPORT_ROOT;
	});

	it("migrates device.json into devices.json and stamps captures", () => {
		const capturesDir = join(root, "captures");
		mkdirSync(capturesDir, { recursive: true });
		writeFileSync(
			join(root, "device.json"),
			`${JSON.stringify(sampleDevice("camp-old", "Legacy"))}\n`,
		);
		writeFileSync(
			join(capturesDir, "cap-1.json"),
			`${JSON.stringify({
				client_capture_id: "cap-1",
				run_id: "run-1",
				source: "watch",
				provider_id: "chatgpt",
				provider_label: "ChatGPT.com (signed-in session)",
				grounded: null,
				query_item_id: "q1",
				question: "Q",
				raw_answer: "A",
				citations: [],
				captured_at: "2026-09-28T00:00:00.000Z",
				account_hint: null,
				sync_status: "pending",
			})}\n`,
		);
		const devices = listDevices();
		assert.equal(devices.length, 1);
		assert.equal(devices[0]?.campaign_id, "camp-old");
		assert.equal(readPrefs().activeCampaignId, "camp-old");
		assert.equal(listCaptures()[0]?.campaign_id, "camp-old");
		assert.equal(listCaptures()[0]?.campaign_name, "Legacy");
		assert.equal(existsSync(join(root, "device.json")), false);
	});

	it("keeps more than one campaign and switches the active one", () => {
		saveDevice(sampleDevice("camp-a", "Alpha"));
		saveDevice(sampleDevice("camp-b", "Beta"));
		assert.equal(listDevices().length, 2);
		assert.equal(readDevice()?.campaign_id, "camp-b");
		setActiveCampaign("camp-a");
		assert.equal(readDevice()?.campaign_id, "camp-a");
		setMaxGroupSize(3);
		assert.equal(readPrefs().maxGroupSize, 3);
		clearDevice();
		assert.equal(listDevices().length, 0);
		assert.equal(readDevice(), null);
	});
});
