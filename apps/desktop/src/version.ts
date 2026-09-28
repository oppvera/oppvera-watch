import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");

export type WatchVersionInfo = {
	version: string;
	productName: string;
};

/** Semver for Oppvera Watch — bump `apps/desktop/package.json` for releases. */
export function readWatchVersion(): WatchVersionInfo {
	try {
		const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
			version?: string;
			build?: { productName?: string };
		};
		return {
			version: pkg.version ?? "0.0.0",
			productName: pkg.build?.productName ?? "Oppvera Watch",
		};
	} catch {
		return { version: "0.0.0", productName: "Oppvera Watch" };
	}
}

export const WATCH_VERSION = readWatchVersion();

export function formatWatchVersionLabel(info: WatchVersionInfo = WATCH_VERSION): string {
	const alpha = /alpha/i.test(info.version);
	const name = alpha ? `${info.productName} (alpha)` : info.productName;
	return `${name} v${info.version}`;
}
