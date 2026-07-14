import type { Metadata } from "next";

// Auth surface — noindex (page is a client component, so robots lives here).
export const metadata: Metadata = { title: "Reset password", robots: { index: false, follow: true } };

export default function ResetLayout({ children }: { children: React.ReactNode }) {
  return children;
}
