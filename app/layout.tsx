import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import Image from "next/image";

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
        <nav className="border-b border-border-subtle bg-surface-dark shadow-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-20">
              <div className="flex items-center space-x-8">
                <Link href="/" className="flex items-center space-x-3">
                  <Image
                    src="/logo.png"
                    alt="YouTube Knowledge Graph"
                    width={48}
                    height={48}
                    className="hover:opacity-80 transition-opacity duration-300"
                  />
                  <span className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-text-light to-accent-cool">
                    YouTube Graph
                  </span>
                </Link>
              </div>
              <div className="flex items-center space-x-1">
                <Link
                  href="/"
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-text-light hover:text-accent-cool hover:glow-text-cool transition-all duration-200 rounded-lg hover:bg-accent-cool/5"
                >
                  Home
                </Link>
                <Link
                  href="/upload"
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-text-light hover:text-accent-cool hover:glow-text-cool transition-all duration-200 rounded-lg hover:bg-accent-cool/5"
                >
                  Upload
                </Link>
                <Link
                  href="/graph"
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-text-light hover:text-accent-cool hover:glow-text-cool transition-all duration-200 rounded-lg hover:bg-accent-cool/5"
                >
                  Graph
                </Link>
                <Link
                  href="/concepts"
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-text-light hover:text-accent-cool hover:glow-text-cool transition-all duration-200 rounded-lg hover:bg-accent-cool/5"
                >
                  Concepts
                </Link>
                <Link
                  href="/segments"
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-text-light hover:text-accent-cool hover:glow-text-cool transition-all duration-200 rounded-lg hover:bg-accent-cool/5"
                >
                  Segments
                </Link>
                <Link
                  href="/query"
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-text-light hover:text-accent-cool hover:glow-text-cool transition-all duration-200 rounded-lg hover:bg-accent-cool/5"
                >
                  Query
                </Link>
              </div>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {children}
        </main>
      </body>
    </html>
  );
}
