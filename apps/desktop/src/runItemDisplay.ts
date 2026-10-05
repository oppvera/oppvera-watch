export const GOOGLE_AI_OVERVIEW_NO_OVERVIEW_TOOLTIP =
	'Google often does not show an AI Overview for a query. From Google documentation: "AI Overviews are only shown when our systems determine that it is additive to classic Search, and as such, often don\'t trigger." Google Search Central — AI features and your website: https://developers.google.com/search/docs/appearance/ai-features';

const AI_OVERVIEW_EXTRACTION_FAIL =
	/Markdown response extraction failed after \d+ retries/i;

export type RunItemDisplayInput = {
	provider: string;
	status: string;
	error?: string | null;
};

export function isGoogleAiOverviewAbsent(item: RunItemDisplayInput): boolean {
	if (item.provider !== "ai-overview" || item.status !== "failed") {
		return false;
	}
	const error = item.error?.trim();
	if (!error || !AI_OVERVIEW_EXTRACTION_FAIL.test(error)) {
		return false;
	}
	const metaMatch = error.match(/\{[\s\S]*\}\s*$/);
	if (metaMatch) {
		try {
			const meta = JSON.parse(metaMatch[0]) as { visibleTextChars?: number };
			if (meta.visibleTextChars === 0) {
				return true;
			}
		} catch {
			// fall through to string match
		}
	}
	return /"visibleTextChars"\s*:\s*0/.test(error);
}

export function formatRunItemStatus(item: RunItemDisplayInput): {
	status: string;
	errorSuffix: string;
	title: string | null;
} {
	if (isGoogleAiOverviewAbsent(item)) {
		return {
			status: "No Overview",
			errorSuffix: "",
			title: GOOGLE_AI_OVERVIEW_NO_OVERVIEW_TOOLTIP,
		};
	}
	return {
		status: item.status,
		errorSuffix: item.error ? ` · ${item.error}` : "",
		title: null,
	};
}
