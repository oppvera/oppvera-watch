import type { Page } from "playwright-core";

function isClaudeHost(url: string): boolean {
	try {
		return new URL(url).hostname.endsWith("claude.ai");
	} catch {
		return false;
	}
}

function isClaudeAuthPath(pathname: string): boolean {
	const path = pathname.toLowerCase();
	return (
		path.includes("/login") ||
		path.includes("/onboarding") ||
		path.includes("/legal") ||
		path.includes("/consent") ||
		path.includes("/terms") ||
		path.includes("/policy")
	);
}

/**
 * Claude uses several intermediate screens (legal, onboarding) on the same host as chat.
 * URL-only checks close the auth window before the user can accept terms.
 */
export async function claudeAuthPageLooksSignedIn(page: Page): Promise<boolean> {
	if (page.isClosed() || !isClaudeHost(page.url())) {
		return false;
	}
	try {
		const path = new URL(page.url()).pathname;
		if (isClaudeAuthPath(path)) {
			return false;
		}
	} catch {
		return false;
	}

	return page
		.evaluate(() => {
			const bodyText = (document.body?.innerText ?? "")
				.replace(/\s+/g, " ")
				.trim();

			if (
				/\b(sign in|log in|create (an )?account|continue with google)\b/i.test(
					bodyText,
				) &&
				!/\bnew chat\b/i.test(bodyText)
			) {
				return false;
			}

			if (
				/\b(i agree|accept terms|accept and continue|review and accept|before you continue)\b/i.test(
					bodyText,
				)
			) {
				return false;
			}

			const composer = document.querySelector(
				'textarea[placeholder*="Message" i], div[contenteditable="true"], [data-testid="chat-input"]',
			);
			if (composer) {
				return true;
			}

			const newChat = document.querySelector('a[href="/new"], a[href*="/chat"]');
			return Boolean(newChat && !/\bsign in\b/i.test(bodyText));
		})
		.catch(() => false);
}
