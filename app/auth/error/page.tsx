import type { Metadata } from "next";
import Link from "next/link";

// Auth error surface — noindex.
export const metadata: Metadata = { robots: { index: false, follow: true } };

export default function AuthErrorPage() {
  return (
    <main className="shell" style={{ textAlign: "center", paddingTop: 60, paddingBottom: 60 }}>
      <h1 className="disp" style={{ fontSize: 28, margin: 0 }}>
        Verification failed
      </h1>
      <p className="body" style={{ fontSize: 17, marginTop: 14, maxWidth: "48ch", marginLeft: "auto", marginRight: "auto" }}>
        The confirmation link may have expired or already been used.
        Try signing in again, or request a new link.
      </p>
      <div style={{ marginTop: 24, display: "flex", gap: 16, justifyContent: "center" }}>
        <Link href="/login" className="btn">Sign in</Link>
        <Link href="/signup" className="link-primary">Create account</Link>
      </div>
    </main>
  );
}
