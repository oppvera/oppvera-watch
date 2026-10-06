import type { AuthProvider } from "@oneglanse/types";
import type { BrowserContext } from "playwright-core";

type StorageState = {
	cookies?: Array<{ name?: string; value?: string; domain?: string }>;
	origins?: Array<{
		origin?: string;
		localStorage?: Array<{ name: string; value: string }>;
	}>;
};

const EMAIL_RE =
	/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+/g;

const EMAIL_KEY_RE = /email|user_email|account/i;

const IGNORE_EMAIL_RE =
	/(?:^|@)(?:noreply|no-reply|mailer-daemon|example\.com|sentry\.io)/i;

const PROVIDER_HOST_HINTS: Record<AuthProvider, string[]> = {
	chatgpt: ["chatgpt.com", "openai.com", "auth.openai.com"],
	claude: ["claude.ai", "anthropic.com"],
	gemini: ["gemini.google.com", "google.com"],
	google: ["google.com", "accounts.google.com"],
	perplexity: ["perplexity.ai"],
};

const MAX_LABEL = 80;

function hostMatchesHint(host: string, hints: readonly string[]): boolean {
	const normalized = host.toLowerCase();
	return hints.some(
		(hint) => normalized === hint || normalized.endsWith(`.${hint}`),
	);
}

function emailsInText(text: string): string[] {
	const found: string[] = [];
	for (const match of text.matchAll(EMAIL_RE)) {
		const email = match[0]?.trim().toLowerCase();
		if (!email || IGNORE_EMAIL_RE.test(email)) continue;
		found.push(email);
	}
	return found;
}

function emailsFromJson(text: string, depth = 0): string[] {
	if (depth > 4) return [];
	const trimmed = text.trim();
	if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
		return emailsInText(trimmed);
	}
	try {
		const parsed: unknown = JSON.parse(trimmed);
		return collectEmailsFromUnknown(parsed, depth);
	} catch {
		return emailsInText(trimmed);
	}
}

function collectEmailsFromUnknown(value: unknown, depth: number): string[] {
	if (depth > 4 || value == null) return [];
	if (typeof value === "string") {
		return emailsFromJson(value, depth + 1);
	}
	if (Array.isArray(value)) {
		return value.flatMap((item) => collectEmailsFromUnknown(item, depth + 1));
	}
	if (typeof value !== "object") return [];

	const emails: string[] = [];
	for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
		if (EMAIL_KEY_RE.test(key) && typeof nested === "string") {
			emails.push(...emailsInText(nested));
		}
		emails.push(...collectEmailsFromUnknown(nested, depth + 1));
	}
	return emails;
}

function scoreEmail(email: string, hostHint: string | null): number {
	let score = 0;
	if (hostHint) score += 10;
	if (!IGNORE_EMAIL_RE.test(email)) score += 1;
	return score;
}

function pickBest(emails: string[], hints: readonly string[]): string | null {
	if (emails.length === 0) return null;
	const unique = [...new Set(emails.map((e) => e.toLowerCase()))];
	const ranked = unique
		.map((email) => {
			const domain = email.split("@")[1] ?? "";
			const onHint = hints.some((hint) =>
				hostMatchesHint(domain, [hint]),
			);
			return { email, score: scoreEmail(email, onHint ? domain : null) };
		})
		.sort((a, b) => b.score - a.score);
	return ranked[0]?.email ?? unique[0] ?? null;
}

function truncateLabel(label: string): string {
	if (label.length <= MAX_LABEL) return label;
	return `${label.slice(0, MAX_LABEL - 1)}…`;
}

/** Best-effort label for the signed-in consumer account (usually an email). */
export function accountLabelFromAuthStorage(
	provider: AuthProvider,
	state: StorageState | null,
): string | null {
	if (!state) return null;
	const hints = PROVIDER_HOST_HINTS[provider] ?? [];
	const prioritized: string[] = [];
	const other: string[] = [];

	for (const originEntry of state.origins ?? []) {
		let hostHint: string | null = null;
		try {
			const host = new URL(originEntry.origin ?? "").hostname;
			hostHint = hostMatchesHint(host, hints) ? host : null;
		} catch {
			hostHint = null;
		}
		for (const item of originEntry.localStorage ?? []) {
			const bucket = hostHint ? prioritized : other;
			if (EMAIL_KEY_RE.test(item.name)) {
				bucket.push(...emailsInText(item.value));
			}
			bucket.push(...emailsFromJson(item.value));
		}
	}

	for (const cookie of state.cookies ?? []) {
		const domain = (cookie.domain ?? "").replace(/^\./, "");
		const bucket =
			domain && hostMatchesHint(domain, hints) ? prioritized : other;
		bucket.push(...emailsInText(cookie.value ?? ""));
		bucket.push(...emailsFromJson(cookie.value ?? ""));
	}

	const label = pickBest(prioritized, hints) ?? pickBest(other, hints);
	return label ? truncateLabel(label) : null;
}

/** Read visible account hints from open auth/capture pages before the context closes. */
export async function accountLabelFromBrowserContext(
	provider: AuthProvider,
	context: BrowserContext,
): Promise<string | null> {
	const hints = PROVIDER_HOST_HINTS[provider] ?? [];
	const emails: string[] = [];

	for (const page of context.pages()) {
		if (page.isClosed()) continue;
		const found = await page
			.evaluate(() => {
				const emails = new Set<string>();
				const re =
					/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+/g;
				const pushMatches = (text: string) => {
					for (const match of text.matchAll(re)) {
						const email = match[0]?.trim().toLowerCase();
						if (email) emails.add(email);
					}
				};

				for (const anchor of document.querySelectorAll('a[href^="mailto:"]')) {
					const href = anchor.getAttribute("href") ?? "";
					pushMatches(
						href.replace(/^mailto:/i, "").split("?")[0]?.trim() ?? "",
					);
				}

				const nodes = document.querySelectorAll(
					'[aria-label], [title], [data-email], [data-testid="profile-button"], [data-testid="user-menu"], [data-testid="accounts-menu"], button[aria-haspopup="menu"]',
				);
				for (const node of nodes) {
					pushMatches(node.getAttribute("aria-label") ?? "");
					pushMatches(node.getAttribute("title") ?? "");
					pushMatches(node.getAttribute("data-email") ?? "");
					pushMatches(node.textContent ?? "");
				}

				return [...emails];
			})
			.catch(() => [] as string[]);

		emails.push(...found);
	}

	const label = pickBest(emails, hints);
	return label ? truncateLabel(label) : null;
}
