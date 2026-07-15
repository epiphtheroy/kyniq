import type { Metadata } from "next";
import Link from "next/link";
import { getAdminUser } from "@/lib/admin";

export const metadata: Metadata = {
  title: "CRM",
  robots: { index: false, follow: false },
};

const NAV_ITEMS = [
  { href: "/crm", label: "Dashboard", icon: "🧭" },
  { href: "/crm/contacts", label: "Contacts", icon: "👤" },
  { href: "/crm/segments", label: "Segments", icon: "🗂️" },
  { href: "/crm/offers", label: "Offers", icon: "🎯" },
  { href: "/crm/rules", label: "Rules", icon: "⏱️" },
  { href: "/crm/outbox", label: "Outbox", icon: "📤" },
  { href: "/crm/inbox", label: "Inbox", icon: "📥" },
  { href: "/crm/research", label: "Research", icon: "🛰️" },
  { href: "/crm/import", label: "Import", icon: "📦" },
  { href: "/crm/settings", label: "Settings", icon: "⚙️" },
];

export default async function CrmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAdminUser();
  // No redirect here: middleware gates every /crm route. Redirecting from the
  // layout would loop with the shared /admin/login page. Render bare instead.
  if (!admin) return <>{children}</>;

  return (
    <>
      <style>{`
        .crm-wrap {
          --ink: #eafff2;
          --muted: #8fb3a0;
          --hairline: rgba(143,179,160,0.22);
          --accent: #34d399;
          --warn: #fbbf24;
          --bad: #f87171;
          --bg: #0b1712;
          --surface: #12241b;
        }
        .crm-wrap input,
        .crm-wrap select,
        .crm-wrap textarea {
          background: #0b1712 !important;
          color: #e2f5ea !important;
          border: 1px solid #24463a !important;
          border-radius: 5px;
          padding: 0.4rem 0.55rem;
          font-size: 0.82rem;
        }
        .crm-wrap table { border-collapse: collapse; width: 100%; }
        .crm-wrap th { color: #8fb3a0 !important; text-align: left; }
        .crm-wrap td { color: #cfe9dc !important; }
        .crm-wrap tr { border-color: #24463a !important; }
        .crm-wrap a { color: var(--accent); }
      `}</style>
      <div className="crm-wrap" style={{ display: "flex", minHeight: "100vh" }}>
        <nav
          style={{
            width: 220,
            background: "#0f2419",
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
            <div style={{ fontFamily: "var(--font-display)", fontSize: "1.125rem", fontWeight: 700 }}>
              Metatake CRM
            </div>
            <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
              {admin.display_name || "Owner"}
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
                padding: "0.6rem 1.25rem",
                color: "rgba(255,255,255,0.85)",
                textDecoration: "none",
                fontSize: "0.8125rem",
                fontWeight: 500,
              }}
            >
              <span style={{ fontSize: "1rem" }}>{item.icon}</span>
              {item.label}
            </Link>
          ))}

          <div style={{ flex: 1 }} />

          <Link href="/admin" style={{ display: "block", padding: "0.5rem 1.25rem", color: "rgba(255,255,255,0.4)", textDecoration: "none", fontSize: "0.72rem" }}>
            ⚙ Admin
          </Link>
          <Link href="/" style={{ display: "block", padding: "0.4rem 1.25rem", color: "rgba(255,255,255,0.4)", textDecoration: "none", fontSize: "0.72rem" }}>
            ← Back to site
          </Link>
        </nav>

        <main style={{ flex: 1, padding: "2rem", overflow: "auto", background: "#12241b", color: "#e2f5ea" }}>
          {children}
        </main>
      </div>
    </>
  );
}
