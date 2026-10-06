import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { claudeAuthPageLooksSignedIn } from "./claudeSignedIn.js";

describe("claudeAuthPageLooksSignedIn", () => {
	it("rejects legal onboarding paths", async () => {
		const page = {
			isClosed: () => false,
			url: () => "https://claude.ai/legal/terms",
			evaluate: async () => true,
		};
		assert.equal(await claudeAuthPageLooksSignedIn(page as never), false);
	});
});
