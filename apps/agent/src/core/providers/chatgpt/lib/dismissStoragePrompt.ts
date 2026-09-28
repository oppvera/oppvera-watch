import { logger } from "@oneglanse/utils";
import type { Page } from "playwright";

const STORAGE_PROMPT_RE = /store data in persistent storage/i;

export async function dismissChatgptStoragePrompt(page: Page): Promise<void> {
	const clicked = await page
		.evaluate((_unused) => {
			const bodyText = document.body?.innerText || "";
			if (!/store data in persistent storage/i.test(bodyText)) return false;
			const allow = Array.from(document.querySelectorAll("button")).find(
				(button) => button.textContent?.trim() === "Allow",
			);
			if (!(allow instanceof HTMLElement)) return false;
			allow.click();
			return true;
		}, null)
		.catch(() => false);

	if (clicked) {
		logger.log("[chatgpt] dismissed persistent storage prompt");
		await page.waitForTimeout(250);
	}
}

export async function pageHasStoragePrompt(page: Page): Promise<boolean> {
	const text = await page
		.evaluate((_unused) => document.body?.innerText || "", null)
		.catch(() => "");
	return STORAGE_PROMPT_RE.test(text);
}
