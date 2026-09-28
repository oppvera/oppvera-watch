import type { WebContents } from "electron";
import type { Provider } from "@oneglanse/types";
import type { CaptureSession } from "./ingest.js";

export type CaptureChildEvent = {
	event: string;
	query_item_id?: string;
	provider?: Provider;
	session?: CaptureSession;
	status?: "pending" | "running" | "captured" | "failed";
	error?: string;
	level?: string;
	message?: string;
};

export function sendCaptureLog(
	web: WebContents | null | undefined,
	level: string,
	message: string,
): void {
	const line = message.trimEnd();
	if (!line) return;
	web?.send("watch:log", { level, message: line });
}

export function handleCaptureStdoutLine(
	line: string,
	handlers: {
		onProgress: (event: CaptureChildEvent) => void;
		onLog?: (level: string, message: string) => void;
		onUnparsed?: (line: string) => void;
	},
): void {
	const trimmed = line.trim();
	if (!trimmed) return;
	try {
		const event = JSON.parse(trimmed) as CaptureChildEvent;
		if (event.event === "log" && event.message) {
			handlers.onLog?.(event.level ?? "log", event.message);
			return;
		}
		if (event.query_item_id && event.provider && event.status) {
			handlers.onProgress(event);
			return;
		}
		handlers.onUnparsed?.(trimmed);
	} catch {
		handlers.onUnparsed?.(trimmed);
	}
}
