import type { Metadata } from "next";

// Auth surface — noindex (page is a client component, so robots lives here).
export const metadata: Metadata = { title: "Log in", robots: { index: false, follow: true } };

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
