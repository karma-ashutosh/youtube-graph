import type { Metadata } from "next";
import "./globals.css";
import MicrosoftClarity from "@/components/analytics/Clarity";
import Navigation from "@/components/Navigation";

export const metadata: Metadata = {
  title: "YouTube Knowledge Graph | Optimize Learning from Videos",
  description: "Find exactly what you need from YouTube videos instantly. Get precise answers with timestamps, explore key segments, and watch the moments that matter—without losing the joy of watching.",
  keywords: ["YouTube", "learning", "video search", "AI", "knowledge graph", "video segments", "timestamps", "educational videos"],
  authors: [{ name: "YouTube Knowledge Graph" }],
  openGraph: {
    title: "YouTube Knowledge Graph | Optimize Learning from Videos",
    description: "Find exactly what you need from YouTube videos instantly—with precise timestamps and AI-powered search.",
    type: "website",
    locale: "en_US",
    siteName: "YouTube Knowledge Graph",
  },
  twitter: {
    card: "summary_large_image",
    title: "YouTube Knowledge Graph | Optimize Learning from Videos",
    description: "Find exactly what you need from YouTube videos instantly—with precise timestamps and AI-powered search.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-primary-dark">
        <MicrosoftClarity />
        <Navigation />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {children}
        </main>
      </body>
    </html>
  );
}
