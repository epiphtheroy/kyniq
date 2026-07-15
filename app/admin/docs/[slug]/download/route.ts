/**
 * GET /admin/docs/[slug]/download — raw markdown source of an admin doc.
 * Same auth gate as the rest of /admin (middleware + getAdminUser re-check).
 * Serves the untouched body string (not the rendered HTML) as a .md attachment.
 */
import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { ADMIN_DOC_BODIES } from "@/lib/admindocs/content";
import { adminDocBySlug } from "@/lib/admindocs/registry";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const admin = await getAdminUser();
  if (!admin) return new NextResponse("Not found", { status: 404 });

  const { slug } = await params;
  const doc = adminDocBySlug(slug);
  const body = ADMIN_DOC_BODIES[slug];
  if (!doc || !body) return new NextResponse("Not found", { status: 404 });

  const md = `# ${doc.title}\n\n${body.trim()}\n`;

  return new NextResponse(md, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}.md"`,
      "Cache-Control": "no-store",
    },
  });
}
