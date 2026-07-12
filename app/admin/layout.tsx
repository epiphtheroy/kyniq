import type { Metadata } from "next";
import Link from "next/link";
import { getAdminUser } from "@/lib/admin";

export const metadata: Metadata = {
  title: "Admin — Metatake",
  robots: { index: false, follow: false },
};

const NAV_ITEMS = [
  { href: "/admin", label: "Control Center", icon: "🎛️" },
  { href: "/admin/metrics", label: "Analytics", icon: "📈" },
  { href: "/admin/review", label: "Q&A Review", icon: "📋" },
  { href: "/admin/content", label: "Content", icon: "📄" },
  { href: "/admin/members", label: "Members", icon: "👥" },
  { href: "/admin/flags", label: "Flags", icon: "🚩" },
  { href: "/admin/audit", label: "Audit Log", icon: "📜" },
  { href: "/admin/pipeline", label: "Pipeline", icon: "⚙️" },
  { href: "/admin/factory", label: "Factory", icon: "🏭" },
  { href: "/admin/activity", label: "Activity Log", icon: "📡" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAdminUser();
  // No redirect here: middleware already gates every /admin route except
  // /admin/login. Redirecting from this layout sent the login page to
  // itself in an infinite loop (ERR_TOO_MANY_REDIRECTS) whenever the
  // session was expired. Render the login page bare instead.
  if (!admin) return <>{children}</>;

  return (
    <>
      <style>{`
        .admin-wrap {
          --ink: #f1f5f9;
          --muted: #94a3b8;
          --hairline: rgba(148,163,184,0.2);
          --accent: #60a5fa;
          --bg: #0f172a;
          --surface: #1e293b;
        }
        .admin-wrap input,
        .admin-wrap select,
        .admin-wrap textarea {
          background: #0f172a !important;
          color: #e2e8f0 !important;
          border-color: #334155 !important;
        }
        .admin-wrap table { border-collapse: collapse; width: 100%; }
        .admin-wrap th { color: #94a3b8 !important; }
        .admin-wrap td { color: #cbd5e1 !important; }
        .admin-wrap tr { border-color: #334155 !important; }
      `}</style>
      <div className="admin-wrap" style={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar */}
      <nav
        style={{
          width: 220,
          background: "#16233F",
          color: "#fff",
          padding: "1.5rem 0",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "0 1.25rem 1.25rem",
            borderBottom: "1px solid rgba(255,255,255,0.12)",
            marginBottom: "0.75rem",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.125rem",
              fontWeight: 700,
            }}
          >
            Metatake Admin
          </div>
          <div
            style={{
              fontSize: "0.75rem",
              color: "rgba(255,255,255,0.5)",
              marginTop: 2,
            }}
          >
            {admin.display_name || "Admin"}
          </div>
        </div>

        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "0.625rem 1.25rem",
              color: "rgba(255,255,255,0.85)",
              textDecoration: "none",
              fontSize: "0.8125rem",
              fontWeight: 500,
              transition: "background 0.15s",
            }}
          >
            <span style={{ fontSize: "1rem" }}>{item.icon}</span>
            {item.label}
          </Link>
        ))}

        <div style={{ flex: 1 }} />

        <Link
          href="/"
          style={{
            display: "block",
            padding: "0.625rem 1.25rem",
            color: "rgba(255,255,255,0.4)",
            textDecoration: "none",
            fontSize: "0.75rem",
          }}
        >
          ← Back to site
        </Link>
      </nav>

      {/* Main content */}
      <main style={{ flex: 1, padding: "2rem", overflow: "auto", background: "#1e293b", color: "#e2e8f0" }}>
        {children}
      </main>
    </div>
    </>
  );
}
