import assert from "node:assert/strict";
import { join } from "node:path";
import { describe, it } from "node:test";
import { pythonActivityLine, venvInterpreterPath } from "./python.ts";

describe("venvInterpreterPath", () => {
	it("uses Scripts/python.exe on Windows", () => {
		const root = join("Oppvera Watch", "python-venv");
		assert.equal(
			venvInterpreterPath(root, "win32"),
			join(root, "Scripts", "python.exe"),
		);
	});

	it("uses bin/python on macOS and Linux", () => {
		const root = join("Oppvera Watch", "python-venv");
		assert.equal(
			venvInterpreterPath(root, "darwin"),
			join(root, "bin", "python"),
		);
		assert.equal(
			venvInterpreterPath(root, "linux"),
			join(root, "bin", "python"),
		);
	});
});

describe("pythonActivityLine", () => {
	it("keeps pip and download lines", () => {
		assert.equal(
			pythonActivityLine("Collecting camoufox"),
			"Collecting camoufox",
		);
		assert.equal(
			pythonActivityLine(
				"Downloading camoufox-1.0.whl (20.1 MB)  5.2/20.1 MB eta 0:00:07",
			),
			"Downloading camoufox-1.0.whl (20.1 MB) 5.2/20.1 MB eta 0:00:07",
		);
	});

	it("drops progress bars that have no words", () => {
		assert.equal(pythonActivityLine("##########"), null);
		assert.equal(pythonActivityLine("   "), null);
	});
});
