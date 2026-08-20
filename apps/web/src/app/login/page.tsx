import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { LoginForm } from "@/components/forms/login-form";
import { env } from "@/env";
import { APP_TAGLINE } from "@/lib/branding";

export default function LoginPage() {
	const showGoogle = !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
	return (
		<AuthPageShell subtitle={APP_TAGLINE}>
			<LoginForm showGoogle={showGoogle} />
		</AuthPageShell>
	);
}
