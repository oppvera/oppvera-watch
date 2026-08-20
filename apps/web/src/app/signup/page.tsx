import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { SignupForm } from "@/components/forms/signup-form";
import { env } from "@/env";
import { APP_TAGLINE } from "@/lib/branding";

export default function SignupPage() {
	const showGoogle = !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
	return (
		<AuthPageShell subtitle={APP_TAGLINE}>
			<SignupForm showGoogle={showGoogle} />
		</AuthPageShell>
	);
}
