import Link from "next/link";

/**
 * RecordToc — a print-style table-of-contents card (2026-07-08): the door to a
 * deeper record page, designed as an index, not an ad. Dotted leaders + tabular
 * counts enumerate exactly what sits behind the link; no imagery, no filled
 * buttons, ink and hairlines only (원우: the backdrop banner read as commercial).
 * Colors are set explicitly so global .mt link/hover inks can't invert them.
 */
export type TocRow = { label: string; value: string | number };

export default function RecordToc({ href, kicker, title, rows, cta }: {
  href: string; kicker: string; title: string; rows: TocRow[]; cta: string;
}) {
  return (
    <Link href={href} className="rec-toc">
      <span className="rec-toc__k">{kicker}</span>
      <span className="rec-toc__t">{title}</span>
      <span className="rec-toc__rows">
        {rows.map((r) => (
          <span className="rec-toc__row" key={r.label}>
            <span className="rec-toc__l">{r.label}</span>
            <span className="rec-toc__lead" aria-hidden />
            <b>{r.value}</b>
          </span>
        ))}
      </span>
      <span className="rec-toc__go">{cta} →</span>
    </Link>
  );
}
