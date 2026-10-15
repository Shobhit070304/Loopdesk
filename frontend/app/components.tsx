import type { ReactNode } from "react";
import Link from "next/link";

/* ── Top Navigation Bar ───────────────────────────────────── */
export function Nav({
  active,
}: {
  active: "home" | "rag" | "ask" | "workflows" | "docs";
}) {
  const linkBase =
    "text-subtle no-underline text-xs tracking-[0.16em] uppercase transition-all duration-200 hover:text-fg py-1.5 px-3 rounded-md";

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md bg-bg/80 border-b border-rim py-3.5">
      <div className="flex justify-between items-center max-w-285 mx-auto px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-serif text-xl text-gold no-underline tracking-[0.08em] group"
        >
          <span>E·RAG</span>
          <span className="text-[10px] font-sans font-normal tracking-widest uppercase border border-gold/40 text-gold px-1.5 py-0.5 rounded bg-gold/5">
            SaaS
          </span>
        </Link>

        <ul className="flex items-center gap-2 list-none m-0 p-0">
          <li>
            <Link
              href="/"
              className={`${linkBase} ${
                active === "home"
                  ? "text-fg bg-white/6 border border-white/8"
                  : ""
              }`}
            >
              Overview
            </Link>
          </li>
          <li>
            <Link
              href="/rag"
              className={`${linkBase} ${
                active === "rag"
                  ? "text-fg bg-white/6 border border-white/8"
                  : ""
              }`}
            >
              Query
            </Link>
          </li>
          <li>
            <Link
              href="/ask"
              className={`${linkBase} ${
                active === "ask"
                  ? "text-fg bg-white/6 border border-white/8"
                  : ""
              }`}
            >
              Ask
            </Link>
          </li>
          <li>
            <Link
              href="/workflows"
              className={`${linkBase} ${
                active === "workflows"
                  ? "text-fg bg-white/6 border border-white/8"
                  : ""
              }`}
            >
              Workflows
            </Link>
          </li>
          <li>
            <Link
              href="/docs"
              className={`${linkBase} ${
                active === "docs"
                  ? "text-fg bg-white/6 border border-white/8"
                  : ""
              }`}
            >
              Docs
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}

/* ── Section Label with Refined Divider ────────────────────── */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-1.5 h-1.5 rounded-full bg-gold/80" />
      <span className="text-subtle text-xs tracking-[0.2em] uppercase whitespace-nowrap font-medium">
        {children}
      </span>
      <div className="flex-1 h-px bg-linear-to-r from-rim via-rim/60 to-transparent" />
    </div>
  );
}
