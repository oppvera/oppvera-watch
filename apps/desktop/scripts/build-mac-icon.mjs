import { execFileSync } from "node:child_process";
import {
	copyFileSync,
	mkdirSync,
	rmSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const desktop = join(dirname(fileURLToPath(import.meta.url)), "..");
const source =
	process.argv[2] ||
	join(desktop, "build", "icon-source.png");
const buildDir = join(desktop, "build");
const iconset = join(buildDir, "icon.iconset");

const sizes = [
	{ name: "icon_16x16.png", size: 16 },
	{ name: "icon_16x16@2x.png", size: 32 },
	{ name: "icon_32x32.png", size: 32 },
	{ name: "icon_32x32@2x.png", size: 64 },
	{ name: "icon_128x128.png", size: 128 },
	{ name: "icon_128x128@2x.png", size: 256 },
	{ name: "icon_256x256.png", size: 256 },
	{ name: "icon_256x256@2x.png", size: 512 },
	{ name: "icon_512x512.png", size: 512 },
	{ name: "icon_512x512@2x.png", size: 1024 },
];

mkdirSync(buildDir, { recursive: true });
const pngMaster = join(buildDir, "icon-master.png");
execFileSync(
	"sips",
	["-s", "format", "png", source, "--out", pngMaster],
	{ stdio: "inherit" },
);
copyFileSync(pngMaster, join(buildDir, "icon.png"));
copyFileSync(pngMaster, join(buildDir, "icon-source.png"));

rmSync(iconset, { recursive: true, force: true });
mkdirSync(iconset, { recursive: true });

for (const { name, size } of sizes) {
	execFileSync(
		"sips",
		["-z", String(size), String(size), pngMaster, "--out", join(iconset, name)],
		{ stdio: "inherit" },
	);
}

execFileSync(
	"iconutil",
	["-c", "icns", iconset, "-o", join(buildDir, "icon.icns")],
	{ stdio: "inherit" },
);

rmSync(iconset, { recursive: true, force: true });
console.log(`Wrote ${join(buildDir, "icon.icns")}`);
