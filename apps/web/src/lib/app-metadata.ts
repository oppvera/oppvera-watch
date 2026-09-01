import { BRAND_LOGO_DARK, BRAND_LOGO_LIGHT } from "@/lib/branding";
import type { Metadata } from "next";

export const appIcons: Metadata["icons"] = {
	icon: [
		{
			url: BRAND_LOGO_LIGHT,
			media: "(prefers-color-scheme: light)",
			type: "image/svg+xml",
		},
		{
			url: BRAND_LOGO_DARK,
			media: "(prefers-color-scheme: dark)",
			type: "image/svg+xml",
		},
	],
	shortcut: [
		{
			url: BRAND_LOGO_LIGHT,
			type: "image/svg+xml",
		},
	],
	apple: [
		{
			url: BRAND_LOGO_LIGHT,
			type: "image/svg+xml",
		},
	],
};
