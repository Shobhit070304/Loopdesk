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
      <body><AuthProvider><AppAccessBoundary>{children}</AppAccessBoundary></AuthProvider></body>
    </html>
  );
}
