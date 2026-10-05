import type { Page } from "playwright-core";

function isPerplexityHost(url: string): boolean {
	try {
		return new URL(url).hostname.endsWith("perplexity.ai");
	} catch {
		return false;
	}
}

function isPerplexityOnboardingUrl(url: string): boolean {
	try {
		const path = new URL(url).pathname.replace(/\/$/, "") || "/";
		return path === "/onboarding" || path.startsWith("/onboarding/");
	} catch {
		return false;
	}
}

/**
 * Perplexity uses the same URLs for signed-in and signed-out sessions (e.g. `/`
 * and `/search/...`). URL matching alone closes the auth window before login.
 */
export async function perplexityAuthPageLooksSignedIn(
	page: Page,
): Promise<boolean> {
	if (page.isClosed() || !isPerplexityHost(page.url())) {
		return false;
	}
	if (isPerplexityOnboardingUrl(page.url())) {
		return false;
	}

	return page
		.evaluate(() => {
			const bodyText = (document.body?.innerText ?? "")
				.replace(/\s+/g, " ")
				.trim();
			if (/sign in to save your history/i.test(bodyText)) {
				return false;
			}

			const controls = document.querySelectorAll("a, button");
			for (const node of controls) {
				const label = (node.textContent ?? "").replace(/\s+/g, " ").trim();
				if (/^sign in$/i.test(label)) {
					return false;
				}
			}

			const accountControl = document.querySelector(
				'[data-testid="user-menu"], [aria-label*="account" i], [aria-label*="profile" i], img[alt*="User" i]',
			);
			if (accountControl) {
				return true;
			}

			// Signed-in free accounts show plan copy in the sidebar (see Perplexity home).
			if (/\bfree plan\b/i.test(bodyText) && /\bupgrade plan\b/i.test(bodyText)) {
				return true;
			}

			return false;
		})
		.catch(() => false);
}
