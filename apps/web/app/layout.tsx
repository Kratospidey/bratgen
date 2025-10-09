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
      <body className="min-h-screen bg-gradient-to-b from-black via-zinc-900 to-black text-white">
        <Providers>
          <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-24 pt-12">
            <header className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold uppercase tracking-tight text-brat">bratgen</h1>
                <p className="max-w-lg text-sm text-zinc-400">
                  upload a clip, drop a spotify link, and let us build a brat-style lyric edit in seconds.
                </p>
              </div>
              <nav className="flex gap-4 text-xs uppercase tracking-widest text-zinc-500">
                <a href="#workflow" className="hover:text-brat">
                  workflow
                </a>
                <a href="#export" className="hover:text-brat">
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
