import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	formatRunItemStatus,
	isGoogleAiOverviewAbsent,
} from "./runItemDisplay.js";

describe("isGoogleAiOverviewAbsent", () => {
	it("detects empty AI Overview extraction failures", () => {
		assert.equal(
			isGoogleAiOverviewAbsent({
				provider: "ai-overview",
				status: "failed",
				error:
					'ai-overview: Markdown response extraction failed after 2 retries — {"visibleTextChars":0,"retries":2}',
			}),
			true,
		);
	});

	it("keeps other provider failures as failed", () => {
		assert.equal(
			isGoogleAiOverviewAbsent({
				provider: "gemini",
				status: "failed",
				error:
					'gemini: Markdown response extraction failed after 2 retries — {"visibleTextChars":0,"retries":2}',
			}),
			false,
		);
	});

	it("keeps AI Overview failures with visible text as failed", () => {
		assert.equal(
			isGoogleAiOverviewAbsent({
				provider: "ai-overview",
				status: "failed",
				error:
					'ai-overview: Markdown response extraction failed after 2 retries — {"visibleTextChars":120,"retries":2}',
			}),
			false,
		);
	});
});

describe("formatRunItemStatus", () => {
	it("labels absent overviews and attaches tooltip", () => {
		const formatted = formatRunItemStatus({
			provider: "ai-overview",
			status: "failed",
			error:
				'ai-overview: Markdown response extraction failed after 2 retries — {"visibleTextChars":0,"retries":2}',
		});
		assert.equal(formatted.status, "No Overview");
		assert.equal(formatted.errorSuffix, "");
		assert.match(formatted.title ?? "", /often don't trigger/i);
	});
});
