export function normalizePairCode(raw: string): string {
	return (raw || "")
		.replace(/[\s.\u2010\u2011\u2012\u2013\u2014\u2212-]/g, "")
		.trim()
		.toUpperCase();
}
