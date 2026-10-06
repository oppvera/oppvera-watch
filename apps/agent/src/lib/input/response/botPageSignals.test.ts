import { describe, it } from "node:test";
import assert from "node:assert/strict";

/** Mirrors domOps detectBotPageState text heuristics (keep in sync). */
function looksLikeActiveHumanChallenge(bodyText: string): boolean {
	const normalized = bodyText.replace(/\s+/g, " ").trim();
	return /please verify you(?:'re| are) human|verify you(?:'re| are) not a robot|complete the security check|unusual traffic from your (?:computer|ip) address/i.test(
		normalized,
	);
}

describe("bot page text signals", () => {
	it("ignores Google reCAPTCHA footer disclaimer on Gemini", () => {
		const footer =
			"This site is protected by reCAPTCHA and the Google Privacy Policy and Terms of Service apply.";
		assert.equal(looksLikeActiveHumanChallenge(footer), false);
	});

	it("flags an active verification prompt", () => {
		assert.equal(
			looksLikeActiveHumanChallenge(
				"Please verify you are human to continue using Gemini.",
			),
			true,
		);
	});
});
