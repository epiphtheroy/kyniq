import type { Metadata } from "next";

// Interactive chat tool — noindex (page is a client component, so robots lives here).
export const metadata: Metadata = { robots: { index: false, follow: true } };

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return children;
}
