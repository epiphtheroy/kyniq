import type { ReactNode } from "react";
import Link from "next/link";

/**
 * QuickAnswers — the shared deterministic Q&A block
 * (docs/PLAN-intent-coverage.md, Wave 0). Server component: an <h2> heading,
 * then one <h3> question + <p> answer per item, assembled entirely from row
 * data by the calling page (LLM-0). Callers mount it below the lead and cap
 * items at 3–6 per the charter; a question whose answer data is absent must
 * never reach this component (§0-1), so an empty list renders nothing.
 */
export type QuickAnswerItem = {
  q: string;
  a: ReactNode;
  /** Optional deep link rendered after the answer. */
  href?: string;
};

export default function QuickAnswers({
  items,
  heading = "Quick answers",
}: {
  items: QuickAnswerItem[];
  heading?: string;
}) {
  if (!items.length) return null;
  return (
    <section style={{ margin: "28px 0" }}>
      <h2 className="df-h2">{heading}</h2>
      {items.map((it) => (
        <div key={it.q} style={{ margin: "14px 0 0" }}>
          <h3 style={{ margin: "0 0 3px", fontSize: 16.5, lineHeight: 1.35 }}>{it.q}</h3>
          <p style={{ margin: 0, lineHeight: 1.6, maxWidth: "70ch" }}>
            {it.a}
            {it.href ? (
              <>
                {" "}
                <Link href={it.href}>More →</Link>
              </>
            ) : null}
          </p>
        </div>
      ))}
    </section>
  );
}
