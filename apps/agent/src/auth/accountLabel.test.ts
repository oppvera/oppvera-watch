import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { accountLabelFromAuthStorage } from "./accountLabel.js";

describe("accountLabelFromAuthStorage", () => {
	it("prefers email on the provider origin", () => {
		const label = accountLabelFromAuthStorage("chatgpt", {
			origins: [
				{
					origin: "https://chatgpt.com",
					localStorage: [
						{
							name: "oai/user",
							value: JSON.stringify({
								email: "agency@client.org",
							}),
						},
					],
				},
				{
					origin: "https://other.example",
					localStorage: [
						{ name: "x", value: "personal@example.com" },
					],
				},
			],
		});
		assert.equal(label, "agency@client.org");
	});

	it("returns null when no email is present", () => {
		const label = accountLabelFromAuthStorage("claude", {
			cookies: [{ name: "session", value: "opaque-token", domain: ".claude.ai" }],
		});
		assert.equal(label, null);
	});
});
