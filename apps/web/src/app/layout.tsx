import "../styles/globals.css";
import { appIcons } from "@/lib/app-metadata";
import { APP_NAME, APP_TAGLINE } from "@/lib/branding";
import { TRPCReactProvider } from "@/trpc/react";
import { Toaster } from "@oneglanse/ui";
import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { Geist } from "next/font/google";

export const metadata: Metadata = {
	metadataBase: new URL(process.env.APP_URL ?? "https://app.oneglanse.com"),
	title: APP_NAME,
	description: APP_TAGLINE,
	robots: {
		index: false,
		follow: false,
	},
	icons: appIcons,
	openGraph: {
		title: APP_NAME,
		description: APP_TAGLINE,
		type: "website",
		images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
	},
	twitter: {
		card: "summary_large_image",
		title: APP_NAME,
		description: APP_TAGLINE,
		images: ["/twitter-image"],
	},
};

const geist = Geist({
	subsets: ["latin"],
	variable: "--font-geist-sans",
});

export default async function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>): Promise<React.JSX.Element> {
	return (
		<html lang="en" className={`${geist.variable}`} suppressHydrationWarning>
			<body>
				<ThemeProvider attribute="class" defaultTheme="light" enableSystem>
					<TRPCReactProvider>
						{children}
						<Toaster />
					</TRPCReactProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
