import type { Metadata } from "next";
import "./globals.css";
import { ReactNode } from "react";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "BratGen",
  description: "Brat-style auto lyric video generator"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="relative min-h-screen bg-[#050505] text-white">
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-20 bg-[radial-gradient(circle_at_top,rgba(203,255,0,0.14),transparent_60%),radial-gradient(circle_at_bottom,rgba(59,130,246,0.18),transparent_65%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 opacity-40 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:80px_80px]"
        />
        <Providers>
          <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-24 pt-12">
            <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div className="space-y-3">
                <p className="text-[11px] uppercase tracking-[0.5em] text-brat/80">the brat studio</p>
                <h1 className="text-4xl font-black uppercase tracking-tight text-white">
                  brat<span className="text-brat">gen</span>
                </h1>
                <p className="max-w-xl text-sm text-zinc-300">
                  Upload a clip, drop a Spotify link, and let the pipeline cut, align, and style a brat-inspired lyric edit for you.
                </p>
              </div>
              <nav className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.35em] text-zinc-400">
                <a
                  href="#workflow"
                  className="rounded-full border border-white/15 px-4 py-2 transition hover:border-brat/60 hover:text-white"
                >
                  workflow
                </a>
                <a
                  href="#export"
                  className="rounded-full border border-white/15 px-4 py-2 transition hover:border-brat/60 hover:text-white"
                >
                  export
                </a>
              </nav>
            </header>
            <main className="mt-12 flex-1">{children}</main>
            <footer className="mt-16 text-xs text-zinc-600">brat aesthetic by design — open alpha.</footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
