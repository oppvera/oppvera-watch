import type { AuthProvider } from "@oneglanse/types";

/** Connect flows that should not preload shared Google/Apple/Facebook cookies. */
const CONNECT_WITHOUT_REUSABLE_IDENTITY: ReadonlySet<AuthProvider> = new Set([
	"gemini",
	"google",
	"perplexity",
]);

export function shouldIncludeReusableIdentitySeed(
	provider: AuthProvider,
): boolean {
	return !CONNECT_WITHOUT_REUSABLE_IDENTITY.has(provider);
}
