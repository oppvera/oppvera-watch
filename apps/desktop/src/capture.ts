import { readFileSync } from "node:fs";
import type { Provider } from "@oneglanse/types";
import { createAgent } from "@oneglanse/agent/create-agent";
import { executePrompt } from "@oneglanse/agent/execute-prompt";
import { captureFromPromptResult } from "./ingest.js";
import { ensureSupportDirs } from "./paths.js";
import { applyDesktopRuntimeEnv } from "./runtimeEnv.js";
import { writeCapture } from "./storage.js";

export type CaptureJob = {
	run_id: string;
	provider: Provider;
	queries: Array<{ query_item_id: string; text: string }>;
	authRoot: string;
	pythonBin?: string | null;
};

function emit(event: string, payload: Record<string, unknown> = {}): void {
	process.stdout.write(`${JSON.stringify({ event, ...payload })}\n`);
}

async function runJob(job: CaptureJob): Promise<void> {
	applyDesktopRuntimeEnv({ authRoot: job.authRoot, pythonBin: job.pythonBin });
	ensureSupportDirs();
	const agent = await createAgent(job.provider);
	try {
		for (const query of job.queries) {
			emit("progress", {
				query_item_id: query.query_item_id,
				provider: job.provider,
				status: "running",
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
				});
				const path = writeCapture(stored);
				emit("captured", {
					query_item_id: query.query_item_id,
					provider: job.provider,
					status: "captured",
					path,
					client_capture_id: stored.client_capture_id,
				});
			} catch (error) {
				emit("failed", {
					query_item_id: query.query_item_id,
					provider: job.provider,
					status: "failed",
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}
	} finally {
		await agent.cleanup();
	}
	emit("done", { provider: job.provider });
}

const jobPath = process.argv[2];
if (!jobPath) {
	throw new Error("Usage: node capture.js <job.json>");
}

const job = JSON.parse(readFileSync(jobPath, "utf8")) as CaptureJob;
runJob(job).catch((error) => {
	emit("failed", {
		error: error instanceof Error ? error.message : String(error),
		status: "failed",
	});
	process.exit(1);
});
