import type { Metadata } from "next";

// User workspace — noindex (page is a client component, so robots lives here).
export const metadata: Metadata = { title: "Settings", robots: { index: false, follow: true } };

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
