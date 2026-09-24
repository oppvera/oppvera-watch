export function applyDesktopRuntimeEnv(input: {
	authRoot: string;
	pythonBin?: string | null;
}): void {
	process.env.ONEGLANSE_APP_MODE = "local";
	process.env.CAMOUFOX_HEADLESS_MODE = "headful";
	process.env.AGENT_AUTH_ROOT_DIR = input.authRoot;
	process.env.REDIS_PASSWORD = process.env.REDIS_PASSWORD || "unused";
	delete process.env.AGENT_AUTH_UPLOAD_URL;
	delete process.env.AGENT_AUTH_UPLOAD_TOKEN;
	if (input.pythonBin) {
		process.env.CAMOUFOX_PYTHON_BIN = input.pythonBin;
	}
}
