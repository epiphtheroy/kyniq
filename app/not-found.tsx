import Link from "next/link";

export default function NotFound() {
  return (
    <main className="shell" style={{ textAlign: "center", paddingTop: 80, paddingBottom: 80 }}>
      <h1 className="disp" style={{ fontSize: 48, margin: 0, color: "var(--muted)" }}>404</h1>
      <p className="body" style={{ fontSize: 20, marginTop: 12 }}>
        This page doesn&apos;t exist — or maybe it hasn&apos;t been filmed yet.
      </p>
      <div style={{ marginTop: 24, display: "flex", gap: 16, justifyContent: "center" }}>
        <Link href="/" className="btn">Go home</Link>
        <Link href="/film" className="link-primary">Browse films</Link>
      </div>
    </main>
  );
}
