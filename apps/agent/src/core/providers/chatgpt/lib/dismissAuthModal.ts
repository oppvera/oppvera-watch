import { logger } from "@oneglanse/utils";
import type { Page } from "playwright";
import {
	canUseOsLevelInput,
	clickLocatorLikeUser,
} from "../../../../lib/browser/humanBehavior.js";

const AUTH_DIALOG_SELECTOR =
	'[role="dialog"], [aria-modal="true"], [data-state="open"]';
const AUTH_DIALOG_TEXT_RE =
	/Thanks for trying ChatGPT|Log in or sign up|Create an account/i;
const DISMISS_MODAL_TEXT_RE =
	/stay logged out|continue without (an account|signing in)|use without an account/i;
const MODAL_POLL_INTERVAL_MS = 200;

type DismissChatgptAuthModalOptions = {
	waitForAppearanceMs?: number;
};

function dismissButton(page: Page) {
	return page
		.locator("button, a, [role='button']")
		.filter({ hasText: DISMISS_MODAL_TEXT_RE })
		.first();
}

export async function chatgptRequiresLogin(page: Page): Promise<boolean> {
	const dismissVisible = await dismissButton(page).isVisible().catch(() => false);
	if (dismissVisible) return false;
	const composer = page
		.locator('#prompt-textarea, [contenteditable="true"][role="textbox"]')
		.first();
	const composerVisible = await composer.isVisible().catch(() => false);
	if (composerVisible) return false;
	const text =
		(await page
			.evaluate((_unused) => document.body?.innerText || "", null)
			.catch(() => "")) || "";
	return AUTH_DIALOG_TEXT_RE.test(text);
}

export async function dismissChatgptAuthModal(
	page: Page,
	options: DismissChatgptAuthModalOptions = {},
): Promise<void> {
	const waitForAppearanceMs = options.waitForAppearanceMs ?? 0;
	const started = Date.now();
	const deadline = started + waitForAppearanceMs;
	const noModalDeadline = started + Math.min(waitForAppearanceMs, 1_200);

	do {
		const dismissTarget = dismissButton(page);
		const dismissVisible = await dismissTarget.isVisible().catch(() => false);
		if (dismissVisible) {
			logger.log("[chatgpt] dismissing guest login wall");
			const clicked = await clickLocatorLikeUser(page, dismissTarget, {
				timeout: 5000,
			}).catch(() => false);
			if (!clicked && canUseOsLevelInput(page)) {
				return;
			}
			await page
				.locator(AUTH_DIALOG_SELECTOR)
				.filter({ hasText: AUTH_DIALOG_TEXT_RE })
				.first()
				.waitFor({ state: "hidden", timeout: 5000 })
				.catch(() => {});
			await page.waitForTimeout(300);
			return;
		}

		const dialogVisible = await page
			.locator(AUTH_DIALOG_SELECTOR)
			.filter({ hasText: AUTH_DIALOG_TEXT_RE })
			.first()
			.isVisible()
			.catch(() => false);
		if (!dialogVisible && Date.now() >= noModalDeadline) return;
		if (Date.now() >= deadline) return;
		await page.waitForTimeout(MODAL_POLL_INTERVAL_MS);
	} while (Date.now() <= deadline);
}
