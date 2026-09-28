import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handleCaptureStdoutLine } from "./captureProtocol.js";

describe("handleCaptureStdoutLine", () => {
	it("parses progress NDJSON", () => {
		const seen: string[] = [];
		handleCaptureStdoutLine(
			JSON.stringify({
				event: "progress",
				query_item_id: "q1",
				provider: "chatgpt",
				status: "running",
			}),
			{
				onProgress: (event) => {
					seen.push(event.status ?? "");
				},
			},
		);
		assert.deepEqual(seen, ["running"]);
	});

	it("routes structured log events", () => {
		const logs: string[] = [];
		handleCaptureStdoutLine(
			JSON.stringify({ event: "log", level: "warn", message: "retrying" }),
			{
				onProgress: () => {},
				onLog: (_level, message) => logs.push(message),
			},
		);
		assert.deepEqual(logs, ["retrying"]);
	});
});
