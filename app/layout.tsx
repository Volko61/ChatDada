import type { Metadata, Viewport } from "next";
import { siteUrl } from "../lib/site";
import "./globals.css";

const siteName = "Chat DADA";
const siteDescription = "Explorez les demandes administratives françaises publiées sur Ma Dada avec l’aide de l’intelligence artificielle.";

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: "Chat DADA — Explorer les demandes publiques",
    template: "%s | Chat DADA"
  },
  description: siteDescription,
  applicationName: siteName,
  keywords: ["Ma Dada", "demandes administratives", "documents publics", "administration française", "recherche IA"],
  authors: [{ name: siteName }],
  creator: siteName,
  publisher: siteName,
  category: "public service",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "/",
    siteName,
    title: "Chat DADA — Explorer les demandes publiques",
    description: siteDescription,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Chat DADA — Explorer les demandes publiques" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Chat DADA — Explorer les demandes publiques",
    description: siteDescription,
    images: ["/opengraph-image"]
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 }
  },
  manifest: "/manifest.webmanifest"
};

export const viewport: Viewport = {
  themeColor: "#143a30",
  colorScheme: "light"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
