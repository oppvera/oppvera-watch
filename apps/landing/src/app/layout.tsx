import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { Geist } from "next/font/google";

const geist = Geist({
	subsets: ["latin"],
	variable: "--font-geist-sans",
});

const REPO_URL = "https://github.com/oppvera/oppvera-watch";

export const metadata: Metadata = {
	metadataBase: new URL(REPO_URL),
	title: "Oppvera Watch | Educational GEO & AI Visibility Tracker",
	description:
		"Oppvera Watch is an educational fork of OneGlanse for learning GEO and AI visibility. Self-hosted, free to run, your data stays on your machine.",
	keywords: [
		"GEO",
		"generative engine optimization",
		"AI visibility",
		"AI visibility tracker",
		"AI visibility tracking",
		"brand visibility AI",
		"ChatGPT brand tracking",
		"Gemini brand tracking",
		"Perplexity brand tracking",
		"open source GEO tool",
		"self-hosted GEO",
		"LLM visibility",
		"AI search optimization",
		"AI mention tracking",
		"oppvera watch",
	],
	alternates: {
		canonical: REPO_URL,
	},
	icons: {
		icon: [
			{
				url: "/logo.png",
				media: "(prefers-color-scheme: light)",
				type: "image/png",
			},
			{
				url: "/logo-dark.png",
				media: "(prefers-color-scheme: dark)",
				type: "image/png",
			},
		],
		shortcut: [
			{
				url: "/logo.png",
				type: "image/png",
			},
		],
		apple: [
			{
				url: "/logo.png",
				type: "image/png",
			},
		],
	},
	openGraph: {
		title: "Oppvera Watch | Educational GEO & AI Visibility Tracker",
		description:
			"Oppvera Watch is an educational fork of OneGlanse for learning GEO and AI visibility. Self-hosted, free to run, your data stays on your machine.",
		url: REPO_URL,
		siteName: "Oppvera Watch",
		type: "website",
		images: [
			{
				url: "/opengraph-image",
				width: 1200,
				height: 630,
				alt: "Oppvera Watch educational AI visibility tracking",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "Oppvera Watch | Educational GEO & AI Visibility Tracker",
		description:
			"Oppvera Watch is an educational fork of OneGlanse for learning GEO and AI visibility. Self-hosted, free to run, your data stays on your machine.",
		images: ["/twitter-image"],
	},
};

const jsonLd = {
	"@context": "https://schema.org",
	"@type": "SoftwareApplication",
	name: "Oppvera Watch",
	url: REPO_URL,
	description:
		"Educational fork of OneGlanse for learning GEO and AI visibility. Monitors how brands appear in ChatGPT, Gemini, Perplexity, Claude, and Google AI Overview using real browser automation.",
	applicationCategory: "BusinessApplication",
	operatingSystem: "Linux, macOS, Windows",
	offers: {
		"@type": "Offer",
		price: "0",
		priceCurrency: "USD",
	},
	license: `${REPO_URL}/blob/main/LICENSE`,
	codeRepository: REPO_URL,
	author: {
		"@type": "Organization",
		name: "Oppvera",
		url: "https://github.com/oppvera",
		sameAs: [REPO_URL],
	},
	keywords:
		"GEO, generative engine optimization, AI visibility, AI tracking, ChatGPT tracking, open source, self-hosted, educational",
};

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
	return (
		<html lang="en" className={geist.variable} suppressHydrationWarning>
			<body>
				<script
					type="application/ld+json"
					// biome-ignore lint/security/noDangerouslySetInnerHtml: structured data for search engines
					dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
				/>
				{children}
				<Analytics />
			</body>
		</html>
	);
}
