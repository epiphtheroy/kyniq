import type { Metadata } from "next";

// Interactive Q&A tool (/ask, /ask/new) — noindex (pages are client components).
export const metadata: Metadata = { title: "Ask Metatake", robots: { index: false, follow: true } };

export default function AskLayout({ children }: { children: React.ReactNode }) {
  return children;
}
