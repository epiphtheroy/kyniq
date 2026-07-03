import type { Metadata } from "next";

// Random-jump tool (+ redirect-only subroutes) — noindex.
export const metadata: Metadata = { robots: { index: false, follow: true } };

export default function RandomLayout({ children }: { children: React.ReactNode }) {
  return children;
}
