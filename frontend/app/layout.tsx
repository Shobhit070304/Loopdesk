import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppAccessBoundary, AuthProvider } from "./components";
import "./globals.css";

export const metadata: Metadata = {
  title: "Loopdesk — Customer intelligence, with a human touch",
  description: "A thoughtful workspace for customer knowledge, AI answers and human-approved workflows.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body><AuthProvider><AppAccessBoundary>{children}</AppAccessBoundary></AuthProvider></body>
    </html>
  );
}
