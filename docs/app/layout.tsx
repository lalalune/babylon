import { Head } from "nextra/components";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "nextra-theme-docs/style.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Babylon Documentation",
  description: "Documentation for Babylon prediction market platform with autonomous agents",
  metadataBase: new URL(process.env.NEXT_PUBLIC_DOCS_URL || process.env.NEXT_PUBLIC_URL || 'http://localhost:3001'),
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head />
      <body>
          {children}
      </body>
    </html>
  );
}
