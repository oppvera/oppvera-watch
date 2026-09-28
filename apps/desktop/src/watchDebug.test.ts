import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldOpenWatchDevTools } from "./watchDebug.ts";

describe("shouldOpenWatchDevTools", () => {
	it("opens for unpackaged apps", () => {
		assert.equal(shouldOpenWatchDevTools(false), true);
	});
});
