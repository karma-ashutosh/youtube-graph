import type { Metadata } from "next";
import "./globals.css";
import MicrosoftClarity from "@/components/analytics/Clarity";
import Navigation from "@/components/Navigation";

export const metadata: Metadata = {
  title: "YouTube Knowledge Graph",
  description: "Explore video transcript concepts in a knowledge graph",
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
