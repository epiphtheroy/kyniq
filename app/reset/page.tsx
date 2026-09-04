"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import Link from "next/link";
import { BrandStack } from "@/components/Brand";

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export default function ResetPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = getSupabase();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/settings`,
    });

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <main className="shell" style={{ maxWidth: 420, textAlign: "center" }}>
        <div style={{ margin: "60px 0" }}>
          <h1 className="disp" style={{ fontSize: 22, marginBottom: 12 }}>Check your email</h1>
          <p className="ui muted" style={{ fontSize: 14, lineHeight: 1.6 }}>
            We sent a password reset link to <strong>{email}</strong>.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="shell" style={{ maxWidth: 420 }}>
      <div style={{ textAlign: "center", margin: "24px 0 26px" }}>
        <Link href="/" className="brandlink" aria-label="Metatake home">
          <BrandStack height={80} label="" />
        </Link>
      </div>

      <h1 className="disp" style={{ fontSize: 22, margin: "0 0 18px", textAlign: "center" }}>
        Reset password
      </h1>

      {error && (
        <div style={{ padding: "10px 13px", marginBottom: 14, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 4, color: "#991b1b", fontSize: 13, fontFamily: "var(--font-ui)" }}>
          {error}
        </div>
      )}

      <form onSubmit={handleReset} style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required className="field" style={{ width: "100%", boxSizing: "border-box", outline: "none" }} />
        <button type="submit" disabled={loading} className="btn" style={{ textAlign: "center", width: "100%", opacity: loading ? 0.6 : 1 }}>
          {loading ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <p className="ui" style={{ fontSize: 13, textAlign: "center", marginTop: 20 }}>
        <Link href="/login" className="accent" style={{ textDecoration: "none" }}>Back to sign in</Link>
      </p>
    </main>
  );
}
