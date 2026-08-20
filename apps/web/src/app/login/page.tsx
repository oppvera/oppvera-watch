import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { LoginForm } from "@/components/forms/login-form";
import { env } from "@/env";

export default function LoginPage() {
	const showGoogle = !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
	return (
		<AuthPageShell>
			<LoginForm showGoogle={showGoogle} />
		</AuthPageShell>
	);
}
