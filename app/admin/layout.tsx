import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";

export const metadata: Metadata = {
  title: "Admin — Kyniq",
  robots: { index: false, follow: false },
};

const NAV_ITEMS = [
  { href: "/admin", label: "Review Queue", icon: "📋" },
  { href: "/admin/content", label: "Content", icon: "📄" },
  { href: "/admin/members", label: "Members", icon: "👥" },
  { href: "/admin/flags", label: "Flags", icon: "🚩" },
  { href: "/admin/audit", label: "Audit Log", icon: "📜" },
  { href: "/admin/pipeline", label: "Pipeline", icon: "⚙️" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAdminUser();
  if (!admin) redirect("/admin/login");

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f8f9fa" }}>
      {/* Sidebar */}
      <nav
        style={{
          width: 220,
          background: "#1A2740",
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
            Kyniq Admin
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
      <main style={{ flex: 1, padding: "2rem", overflow: "auto", background: "#fff", color: "#1A2740" }}>
        {children}
      </main>
    </div>
  );
}
