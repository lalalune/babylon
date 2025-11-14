import { Head } from "nextra/components";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "nextra-theme-docs/style.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Babylon Documentation",
  description: "Documentation for Babylon social conspiracy game",
  metadataBase: new URL(process.env.NEXT_PUBLIC_DOCS_URL || process.env.NEXT_PUBLIC_URL || 'http://localhost:3001'),
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
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
