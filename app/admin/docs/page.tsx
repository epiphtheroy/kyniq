/**
 * /admin/docs — internal admin document library index.
 *
 * Lists admin-only docs grouped by category (lib/admindocs/registry.ts). Bodies
 * render at /admin/docs/[slug]. Same auth posture as the other admin pages:
 * middleware gates /admin/*, and this page re-verifies with getAdminUser().
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { ADMIN_DOC_CATEGORIES, ADMIN_DOCS, adminDocsInCategory, adminDocHref } from "@/lib/admindocs/registry";

export const dynamic = "force-dynamic";

const card: React.CSSProperties = {
  display: "block",
  background: "#0f172a",
  border: "1px solid var(--hairline)",
  borderRadius: 8,
  padding: "1rem 1.125rem",
  textDecoration: "none",
  color: "inherit",
};

export default async function AdminDocsIndex() {
  const admin = await getAdminUser();
  if (!admin) notFound();

  return (
    <div style={{ maxWidth: 920 }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", margin: "0 0 0.25rem" }}>Docs</h1>
      <p style={{ color: "var(--muted)", margin: "0 0 1.75rem", fontSize: "0.875rem" }}>
        내부 문서 라이브러리 — 전략·성장·운영 노트. 문서 {ADMIN_DOCS.length}건.
      </p>

      {ADMIN_DOC_CATEGORIES.map((cat) => {
        const docs = adminDocsInCategory(cat.key);
        if (!docs.length) return null;
        return (
          <section key={cat.key} style={{ marginBottom: "1.75rem" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: "0.75rem" }}>
              <h2 style={{ fontSize: "0.95rem", fontWeight: 700, margin: 0 }}>{cat.label}</h2>
              <span style={{ color: "var(--muted)", fontSize: "0.8125rem" }}>{cat.blurb}</span>
            </div>
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {docs.map((d) => (
                <Link key={d.slug} href={adminDocHref(d.slug)} style={card}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                    <span style={{ fontWeight: 600, color: "var(--ink)" }}>{d.nav}</span>
                    {d.updated ? (
                      <span style={{ color: "var(--muted)", fontSize: "0.75rem", flexShrink: 0 }}>{d.updated}</span>
                    ) : null}
                  </div>
                  <p style={{ color: "var(--muted)", fontSize: "0.8125rem", margin: "0.375rem 0 0", lineHeight: 1.5 }}>
                    {d.desc}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
