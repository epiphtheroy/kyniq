/**
 * /admin/docs/[slug] — admin document reader.
 *
 * Looks up the markdown body (lib/admindocs/content), renders it with the shared
 * deterministic renderer (lib/docs/md.ts), and styles md.ts's output classes for
 * the dark admin theme (methodology.css is scoped to /methodology, so we ship a
 * minimal scoped stylesheet here). Same auth posture as the rest of /admin.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { renderDocMarkdown } from "@/lib/docs/md";
import { ADMIN_DOC_BODIES } from "@/lib/admindocs/content";
import { adminDocBySlug, adminCategoryBySlug } from "@/lib/admindocs/registry";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export default async function AdminDocReader({ params }: Props) {
  const admin = await getAdminUser();
  if (!admin) notFound();

  const { slug } = await params;
  const doc = adminDocBySlug(slug);
  const body = ADMIN_DOC_BODIES[slug];
  if (!doc || !body) notFound();

  const cat = adminCategoryBySlug(slug);
  const html = renderDocMarkdown(body);

  return (
    <div className="adoc" style={{ maxWidth: 920 }}>
      <style>{`
        .adoc .adoc-crumb { color: var(--muted); font-size: 0.8125rem; margin-bottom: 0.75rem; }
        .adoc .adoc-crumb a { color: var(--accent); text-decoration: none; }
        .adoc h1 { font-family: var(--font-display); font-size: 1.6rem; margin: 0 0 0.35rem; color: var(--ink); }
        .adoc .adoc-standfirst { color: var(--muted); font-size: 0.95rem; line-height: 1.6; margin: 0 0 0.4rem; }
        .adoc .adoc-meta { color: var(--muted); font-size: 0.75rem; margin: 0 0 1.75rem; }
        .adoc .adoc-body { color: #cbd5e1; font-size: 0.9rem; line-height: 1.7; }
        .adoc .adoc-body .md-h2 { font-size: 1.15rem; font-weight: 700; color: var(--ink); margin: 2rem 0 0.15rem; }
        .adoc .adoc-body .tick { width: 26px; height: 3px; background: var(--accent); border-radius: 2px; margin: 0 0 0.9rem; }
        .adoc .adoc-body .md-h3 { font-size: 1rem; font-weight: 700; color: var(--ink); margin: 1.5rem 0 0.5rem; }
        .adoc .adoc-body .md-h4 { font-size: 0.9rem; font-weight: 700; color: var(--ink); margin: 1.15rem 0 0.4rem; }
        .adoc .adoc-body p.body { margin: 0 0 0.85rem; }
        .adoc .adoc-body ul, .adoc .adoc-body ol { margin: 0 0 1rem; padding-left: 1.35rem; }
        .adoc .adoc-body li { margin: 0.3rem 0; }
        .adoc .adoc-body a { color: var(--accent); text-decoration: none; }
        .adoc .adoc-body a:hover { text-decoration: underline; }
        .adoc .adoc-body strong { color: var(--ink); }
        .adoc .adoc-body hr.rule { border: 0; border-top: 1px solid var(--hairline); margin: 2rem 0; }
        .adoc .adoc-body .md-tablewrap { overflow-x: auto; margin: 0 0 1.25rem; border: 1px solid var(--hairline); border-radius: 8px; }
        .adoc .adoc-body .md-table { border-collapse: collapse; width: 100%; font-size: 0.82rem; min-width: 560px; }
        .adoc .adoc-body .md-table th { text-align: left; padding: 0.5rem 0.7rem; background: #0f172a; color: var(--muted) !important; font-weight: 600; border-bottom: 1px solid var(--hairline); white-space: nowrap; }
        .adoc .adoc-body .md-table td { padding: 0.5rem 0.7rem; color: #cbd5e1 !important; border-bottom: 1px solid var(--hairline); vertical-align: top; }
        .adoc .adoc-body .md-table tr:last-child td { border-bottom: 0; }
        .adoc .adoc-body blockquote.md-note { border-left: 3px solid var(--accent); margin: 0 0 1rem; padding: 0.25rem 0 0.25rem 0.9rem; color: var(--muted); }
        .adoc .adoc-body .md-tiles { display: flex; flex-wrap: wrap; gap: 0.75rem; margin: 0 0 1.25rem; }
        .adoc .adoc-body .md-tile { background: #0f172a; border: 1px solid var(--hairline); border-radius: 8px; padding: 0.75rem 1rem; min-width: 150px; }
        .adoc .adoc-body .md-tile-n { font-size: 1.35rem; font-weight: 700; color: var(--ink); }
        .adoc .adoc-body .md-tile-l { font-size: 0.8rem; color: var(--muted); margin-top: 2px; }
        .adoc .adoc-body .md-tile-d { font-size: 0.75rem; color: var(--muted); margin-top: 4px; }
        .adoc .adoc-body .md-details { border: 1px solid var(--hairline); border-radius: 8px; padding: 0.6rem 0.9rem; margin: 0 0 1rem; }
        .adoc .adoc-body .md-details summary { cursor: pointer; font-weight: 600; color: var(--ink); }
      `}</style>

      <div className="adoc-crumb">
        <Link href="/admin/docs">Docs</Link>
        {cat ? <> › {cat.label}</> : null} › {doc.title}
      </div>
      <h1>{doc.title}</h1>
      <p className="adoc-standfirst">{doc.desc}</p>
      {doc.updated ? <p className="adoc-meta">최종 업데이트 {doc.updated}</p> : null}

      <div className="adoc-body" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
