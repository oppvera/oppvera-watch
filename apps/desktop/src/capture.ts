import { readFileSync } from "node:fs";
import { BaseError } from "@oneglanse/errors";
import type { Provider } from "@oneglanse/types";
import { createAgent } from "@oneglanse/agent/create-agent";
import {
	executePrompt,
	prepareNextPrompt,
} from "@oneglanse/agent/execute-prompt";
import {
	captureFailureRecord,
	captureFromPromptResult,
	type CaptureSession,
} from "./ingest.js";
import { ensureSupportDirs } from "./paths.js";
import { applyDesktopRuntimeEnv } from "./runtimeEnv.js";
import { writeCapture } from "./storage.js";

export type CaptureJob = {
	run_id: string;
	provider: Provider;
	session: CaptureSession;
	queries: Array<{ query_item_id: string; text: string }>;
	authRoot: string;
	pythonBin?: string | null;
	campaign_id: string;
	campaign_name?: string;
};

function emit(event: string, payload: Record<string, unknown> = {}): void {
	process.stdout.write(`${JSON.stringify({ event, ...payload })}\n`);
}

/** Agent logging uses console.log; route to NDJSON log events only (no stderr dupes). */
function routeAgentLogsToEvents(): void {
	const toLine = (args: unknown[]) =>
		args
			.map((arg) =>
				arg instanceof Error ? arg.stack || arg.message : String(arg),
			)
			.join(" ");

	const forward =
		(level: "log" | "warn" | "error") =>
		(...args: unknown[]) => {
			emit("log", { level, message: toLine(args) });
		};

	console.log = forward("log");
	console.warn = forward("warn");
	console.error = forward("error");
}

function formatCaptureError(error: unknown): string {
	if (error instanceof BaseError) {
		const meta =
			error.meta && Object.keys(error.meta).length > 0
				? ` — ${JSON.stringify(error.meta)}`
				: "";
		return `${error.message}${meta}`;
	}
	if (error instanceof Error) return error.message;
	return String(error);
}

async function runJob(job: CaptureJob): Promise<void> {
	routeAgentLogsToEvents();
	const session: CaptureSession =
		job.session === "signed-out" ? "signed-out" : "signed-in";
	applyDesktopRuntimeEnv({ authRoot: job.authRoot, pythonBin: job.pythonBin });
	if (session === "signed-out") {
		process.env.WATCH_USE_AUTH_SESSION = "0";
	} else {
		delete process.env.WATCH_USE_AUTH_SESSION;
	}
	ensureSupportDirs();
	const agent = await createAgent(job.provider);
	try {
		for (let i = 0; i < job.queries.length; i++) {
			const query = job.queries[i];
			if (!query) continue;
			emit("progress", {
				query_item_id: query.query_item_id,
				provider: job.provider,
				session,
				status: "running",
				campaign_id: job.campaign_id,
				campaign_name: job.campaign_name,
			});
			try {
				const { response, sources } = await executePrompt(
					agent.page,
					query.text,
					job.provider,
				);
				const stored = captureFromPromptResult({
					run_id: job.run_id,
					provider: job.provider,
					query_item_id: query.query_item_id,
					question: query.text,
					response,
					sources,
					session,
					campaign_id: job.campaign_id,
					campaign_name: job.campaign_name,
				});
				const path = writeCapture(stored);
				emit("captured", {
					query_item_id: query.query_item_id,
					provider: job.provider,
					session,
					status: "captured",
					path,
					client_capture_id: stored.client_capture_id,
					campaign_id: job.campaign_id,
					campaign_name: job.campaign_name,
				});
			} catch (error) {
				const message = formatCaptureError(error);
				const failed = captureFailureRecord({
					run_id: job.run_id,
					provider: job.provider,
					query_item_id: query.query_item_id,
					question: query.text,
					error: message,
					session,
					campaign_id: job.campaign_id,
					campaign_name: job.campaign_name,
				});
				writeCapture(failed);
				emit("failed", {
					query_item_id: query.query_item_id,
					provider: job.provider,
					session,
					status: "failed",
					error: formatCaptureError(error),
					campaign_id: job.campaign_id,
					campaign_name: job.campaign_name,
				});
			}
			if (i < job.queries.length - 1) {
				await prepareNextPrompt(agent.page, job.provider);
			}
		}
	} finally {
		await agent.cleanup();
	}
	emit("done", { provider: job.provider, session });
}

const jobPath = process.argv[2];
if (!jobPath) {
	throw new Error("Usage: node capture.js <job.json>");
}

const job = JSON.parse(readFileSync(jobPath, "utf8")) as CaptureJob;
runJob(job).catch((error) => {
	emit("failed", {
		error: formatCaptureError(error),
		status: "failed",
	});
	process.exit(1);
});
