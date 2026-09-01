import { BRAND_LOGO_DARK, BRAND_LOGO_LIGHT } from "@/lib/branding";
import type { Metadata } from "next";

export const appIcons: Metadata["icons"] = {
	icon: [
		{
			url: BRAND_LOGO_LIGHT,
			media: "(prefers-color-scheme: light)",
			type: "image/png",
		},
		{
			url: BRAND_LOGO_DARK,
			media: "(prefers-color-scheme: dark)",
			type: "image/png",
		},
	],
	shortcut: [
		{
			url: BRAND_LOGO_LIGHT,
			type: "image/png",
		},
	],
	apple: [
		{
			url: BRAND_LOGO_LIGHT,
			type: "image/png",
		},
	],
};
