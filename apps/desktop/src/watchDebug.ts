import { WATCH_VERSION } from "./version.js";

/** Prerelease builds (e.g. 0.3.1-alpha) get verbose agent logs and DevTools. */
export function isWatchAlphaRelease(): boolean {
	return /alpha/i.test(WATCH_VERSION.version);
}

export function shouldOpenWatchDevTools(appIsPackaged: boolean): boolean {
	if (!appIsPackaged) return true;
	if (process.env.WATCH_OPEN_DEVTOOLS === "1") return true;
	if (process.env.WATCH_OPEN_DEVTOOLS === "true") return true;
	return isWatchAlphaRelease();
}

export function shouldEnableAgentDebugLogs(): boolean {
	if (process.env.DEBUG_ENABLED === "1" || process.env.DEBUG_ENABLED === "true") {
		return true;
	}
	if (process.env.WATCH_DEBUG_LOGS === "1" || process.env.WATCH_DEBUG_LOGS === "true") {
		return true;
	}
	return isWatchAlphaRelease();
}

export function applyWatchDebugEnv(): void {
	if (shouldEnableAgentDebugLogs()) {
		process.env.DEBUG_ENABLED = "1";
	}
}
