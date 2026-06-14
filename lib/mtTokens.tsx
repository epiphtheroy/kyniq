import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Token link renderer (meta-take-architecture.md §6).
 * Stored content uses stable tokens: {{film:slug}}, {{meta_take:slug}},
 * {{take:id}}. At render time they resolve to the CURRENT title + href, so a
 * meta take rename/merge never breaks stored prose — the prose holds the id,
 * the link is computed. Unknown tokens fall back to plain text (no redlinks).
 */

export interface TokenResolver {
  film?: Record<string, { title: string }>;
  meta_take?: Record<string, { title: string }>;
}

const TOKEN = /\{\{(film|meta_take|take):([^}]+)\}\}/g;

function hrefFor(kind: string, id: string): string | null {
  if (kind === "film") return `/film/${id}`;
  if (kind === "meta_take") return `/take/${id}`;
  return null;
}

export function renderTokens(text: string | null | undefined, resolver: TokenResolver = {}): ReactNode[] {
  if (!text) return [];
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  TOKEN.lastIndex = 0;
  let key = 0;
  while ((m = TOKEN.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const kind = m[1];
    const id = m[2];
    const href = hrefFor(kind, id);
    const dict = kind === "film" ? resolver.film : kind === "meta_take" ? resolver.meta_take : undefined;
    const label = dict?.[id]?.title;
    if (href && label) {
      out.push(
        <Link key={`t${key++}`} href={href} className="mt-link">
          {label}
        </Link>
      );
    } else if (href) {
      // resolvable href but no title provided — render the id humanised
      out.push(
        <Link key={`t${key++}`} href={href} className="mt-link">
          {id.replace(/-/g, " ")}
        </Link>
      );
    } else {
      out.push(label ?? id);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
