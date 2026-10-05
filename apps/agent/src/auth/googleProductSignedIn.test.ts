import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	isGeminiAppHost,
	isGoogleSearchHomeHost,
} from "./googleProductSignedIn.js";

describe("isGeminiAppHost", () => {
	it("matches Gemini app origins only", () => {
		assert.equal(isGeminiAppHost("https://gemini.google.com/app"), true);
		assert.equal(isGeminiAppHost("https://accounts.google.com/"), false);
	});
});

describe("isGoogleSearchHomeHost", () => {
	it("matches Google Search home only", () => {
		assert.equal(isGoogleSearchHomeHost("https://www.google.com/"), true);
		assert.equal(isGoogleSearchHomeHost("https://accounts.google.com/"), false);
	});
});
