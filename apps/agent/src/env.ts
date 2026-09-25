import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { APP_MODE_LIST } from "@oneglanse/types";
import dotenv from "dotenv";
import { z } from "zod";

const envFilePath = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
	"..",
	"..",
	".env",
);

if (process.env.NODE_ENV !== "production") {
	if (fs.existsSync(envFilePath)) {
		dotenv.config({ path: envFilePath });
	}
}

const AgentEnvSchema = z.object({
	NODE_ENV: z
		.enum(["development", "test", "production"])
		.default("development"),
	ONEGLANSE_APP_MODE: z.enum(APP_MODE_LIST).default("local"),
	PROXY_SCHEME: z.enum(["http", "https"]).optional(),
	THORDATA_PROXY_API_URL: z.string().trim().url().optional(),
});

export const env = AgentEnvSchema.parse(process.env);
