import type { Metadata } from "next";

// Auth surface — noindex (page is a client component, so robots lives here).
export const metadata: Metadata = { robots: { index: false, follow: true } };

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
