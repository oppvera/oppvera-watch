import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldIncludeReusableIdentitySeed } from "./launchSeed.js";

describe("shouldIncludeReusableIdentitySeed", () => {
	it("skips shared identity for Google-backed consumer providers", () => {
		assert.equal(shouldIncludeReusableIdentitySeed("gemini"), false);
		assert.equal(shouldIncludeReusableIdentitySeed("google"), false);
		assert.equal(shouldIncludeReusableIdentitySeed("perplexity"), false);
	});

	it("keeps shared identity for ChatGPT and Claude", () => {
		assert.equal(shouldIncludeReusableIdentitySeed("chatgpt"), true);
		assert.equal(shouldIncludeReusableIdentitySeed("claude"), true);
	});
});
