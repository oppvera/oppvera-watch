import type { MetadataRoute } from "next";
import { SITE_URLS } from "@/lib/landing-content";

export default function sitemap(): MetadataRoute.Sitemap {
	return [
		{
			url: SITE_URLS.homepage,
			lastModified: new Date(),
			changeFrequency: "weekly",
			priority: 1,
		},
		{
			url: `${SITE_URLS.homepage}/tree/main/docs`,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.8,
		},
	];
}
