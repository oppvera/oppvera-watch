import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { SignupForm } from "@/components/forms/signup-form";
import { env } from "@/env";

export default function SignupPage() {
	const showGoogle = !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
	return (
		<AuthPageShell>
			<SignupForm showGoogle={showGoogle} />
		</AuthPageShell>
	);
}
