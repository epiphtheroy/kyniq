"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BrandLockup } from "@/components/Brand";

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const router = useRouter();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = getSupabase();
    // First-run flow (전환마스터 §5): land new accounts on /me/import so the
    // portfolio lights up immediately. If the redirect URL isn't allowlisted,
    // Supabase falls back to the site URL — no worse than the old behavior.
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/me/import")}`,
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  async function handleGoogleLogin() {
    const supabase = getSupabase();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/me/import")}`,
      },
    });
  }

  if (sent) {
    return (
      <main className="shell" style={{ maxWidth: 420, textAlign: "center" }}>
        <div style={{ margin: "60px 0" }}>
          <h1 className="disp" style={{ fontSize: 22, marginBottom: 12 }}>Check your email</h1>
          <p className="ui muted" style={{ fontSize: 14, lineHeight: 1.6 }}>
            We sent a verification link to <strong>{email}</strong>. Click it to activate your
            account — then we&apos;ll take you straight to importing your films.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="shell" style={{ maxWidth: 420 }}>
      <div style={{ textAlign: "center", margin: "24px 0 26px" }}>
        <Link href="/" className="brandlink" aria-label="Metatake home">
          <BrandLockup size={30} />
        </Link>
        <div className="tagline" style={{ marginTop: 6 }}>Read films closely.</div>
      </div>

      <h1 className="disp" style={{ fontSize: 22, margin: "0 0 10px", textAlign: "center" }}>
        Create your cinema portfolio
      </h1>
      <ul className="ui muted" style={{ fontSize: 13, lineHeight: 1.7, listStyle: "none", padding: 0, margin: "0 0 18px", textAlign: "center" }}>
        <li>Your watch history as one map — coverage, blind spots, taste</li>
        <li>Tonight picks scored for cinephiles, filtered to your services</li>
        <li>A shelf for the films and readings you save</li>
      </ul>

      {error && (
        <div style={{ padding: "10px 13px", marginBottom: 14, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 4, color: "#991b1b", fontSize: 13, fontFamily: "var(--font-ui)" }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          className="field"
          style={{ width: "100%", boxSizing: "border-box", outline: "none" }}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          minLength={6}
          className="field"
          style={{ width: "100%", boxSizing: "border-box", outline: "none" }}
        />
        <button type="submit" disabled={loading} className="btn" style={{ textAlign: "center", width: "100%", opacity: loading ? 0.6 : 1 }}>
          {loading ? "Creating…" : "Create account"}
        </button>
      </form>

      <div className="ui muted" style={{ textAlign: "center", fontSize: 12, margin: "16px 0" }}>or</div>

      <button
        onClick={handleGoogleLogin}
        className="field"
        style={{ display: "block", width: "100%", textAlign: "center", cursor: "pointer", background: "var(--surface)", boxSizing: "border-box" }}
      >
        Sign up with Google
      </button>
      <p className="ui muted" style={{ fontSize: 11.5, textAlign: "center", margin: "8px 0 0" }}>
        One click — no email verification needed.
      </p>

      <p className="ui muted" style={{ fontSize: 11.5, lineHeight: 1.6, textAlign: "center", margin: "18px 0 0" }}>
        By joining you agree to our{" "}
        <Link href="/terms" className="accent" style={{ textDecoration: "none" }}>Terms</Link> and{" "}
        <Link href="/privacy" className="accent" style={{ textDecoration: "none" }}>Privacy Policy</Link>.
        We&apos;ll email a link to verify your address.
      </p>

      <p className="ui" style={{ fontSize: 13, textAlign: "center", marginTop: 20 }}>
        Already have an account?{" "}
        <Link href="/login" className="accent" style={{ textDecoration: "none" }}>Sign in</Link>
      </p>
    </main>
  );
}
