import type { AuthProvider } from "@oneglanse/types";
import { runAuthLogin } from "@oneglanse/agent/auth-cli";
import { applyDesktopRuntimeEnv } from "./runtimeEnv.js";

process.on("uncaughtException", (error) => {
	console.error(error instanceof Error ? error.stack || error.message : String(error));
	process.exit(1);
});

const provider = process.argv[2] as AuthProvider;
const authRoot = process.argv[3];
const pythonBin = process.argv[4] || undefined;
if (!provider || !authRoot) {
	throw new Error("Usage: node auth-child.js <provider> <authRoot> [pythonBin]");
}

applyDesktopRuntimeEnv({ authRoot, pythonBin });
runAuthLogin(provider)
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error instanceof Error ? error.stack || error.message : String(error));
		process.exit(1);
	});
