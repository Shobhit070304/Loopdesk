import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Enterprise RAG — Intelligent Hybrid Search & Automations",
  description:
    "A hybrid semantic + keyword retrieval and SaaS decision automation platform powered by pgvector and Gemini.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
