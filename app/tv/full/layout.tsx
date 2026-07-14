import type { Metadata } from "next";

// Full-screen TV kiosk — noindex (page is a client component, so robots lives
// here). The indexable watch surface is /tv; this duplicate view stays out of
// the index now that the canonical no longer leaks from app/tv/layout.tsx.
export const metadata: Metadata = {
  title: { absolute: "METATAKE TV — On Air" },
  robots: { index: false, follow: true },
};

export default function TVFullLayout({ children }: { children: React.ReactNode }) {
  return children;
}
