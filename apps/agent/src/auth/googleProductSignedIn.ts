import type { Page } from "playwright-core";

export function isGeminiAppHost(url: string): boolean {
	try {
		const host = new URL(url).hostname.toLowerCase();
		return host === "gemini.google.com" || host.endsWith(".gemini.google.com");
	} catch {
		return false;
	}
}

export function isGoogleSearchHomeHost(url: string): boolean {
	try {
		const host = new URL(url).hostname.toLowerCase();
		return host === "www.google.com" || host === "google.com";
	} catch {
		return false;
	}
}

/**
 * Gemini uses /app and other paths before Google sign-in finishes. URL rules treat
 * any gemini.google.com path as signed in after two seconds.
 */
export async function geminiAuthPageLooksSignedIn(page: Page): Promise<boolean> {
	if (page.isClosed() || !isGeminiAppHost(page.url())) {
		return false;
	}

	return page
		.evaluate(() => {
			const visible = (el: Element | null): el is HTMLElement => {
				if (!(el instanceof HTMLElement)) return false;
				const style = window.getComputedStyle(el);
				if (
					style.display === "none" ||
					style.visibility === "hidden" ||
					style.opacity === "0"
				) {
					return false;
				}
				const rect = el.getBoundingClientRect();
				return rect.width > 0 && rect.height > 0;
			};

			for (const node of document.querySelectorAll("a, button")) {
				const label = (node.textContent ?? "").replace(/\s+/g, " ").trim();
				if (
					/^sign in$/i.test(label) ||
					/^sign in with google$/i.test(label) ||
					/^log in$/i.test(label)
				) {
					return false;
				}
			}

			const composerSelectors = [
				'div[aria-label="Enter a prompt for Gemini"]',
				'rich-textarea [contenteditable="true"][role="textbox"]',
				'div[contenteditable="true"][role="textbox"][aria-multiline="true"]',
			];
			for (const selector of composerSelectors) {
				if (visible(document.querySelector(selector))) {
					return true;
				}
			}

			const account = document.querySelector(
				'a[aria-label*="Google Account" i], a[aria-label*="Google account" i]',
			);
			const newChat = document.querySelector(
				'button[aria-label*="New chat" i], a[aria-label*="New chat" i]',
			);
			if (visible(account) && visible(newChat)) {
				return true;
			}

			return false;
		})
		.catch(() => false);
}

/**
 * www.google.com uses the same homepage for signed-in and signed-out search.
 * Require account chrome, not the URL alone.
 */
export async function googleSearchAuthPageLooksSignedIn(
	page: Page,
): Promise<boolean> {
	if (page.isClosed() || !isGoogleSearchHomeHost(page.url())) {
		return false;
	}

	return page
		.evaluate(() => {
			const visible = (el: Element | null): el is HTMLElement => {
				if (!(el instanceof HTMLElement)) return false;
				const style = window.getComputedStyle(el);
				if (
					style.display === "none" ||
					style.visibility === "hidden" ||
					style.opacity === "0"
				) {
					return false;
				}
				const rect = el.getBoundingClientRect();
				return rect.width > 0 && rect.height > 0;
			};

			const signIn = document.querySelector(
				'a[aria-label="Sign in"], a[href*="ServiceLogin"]',
			);
			if (visible(signIn)) {
				return false;
			}

			const account = document.querySelector(
				'a[aria-label*="Google Account" i], a[aria-label*="Google account" i]',
			);
			return visible(account);
		})
		.catch(() => false);
}
