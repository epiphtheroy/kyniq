/** My Room v3 — <FormingCard>: one component, one voice for every cold start
 *  (spec §1 graft, all three judges). Every gate states its unlock number and
 *  links to the Ledger (rate) and Import (bulk). No fake numbers: the meter is
 *  have/need, nothing else.
 *  Server-safe (no handlers) — usable from server pages and client workspaces. */
import Link from "next/link";
import type { ReactNode } from "react";
import { STR } from "./strings";

export default function FormingCard({
  feature, need, have, unit, cta, showImport = true, children,
}: {
  /** What unlocks, e.g. "Masquerade", "Recommendations". */
  feature: string;
  /** Unlock threshold (explicit — never hide the number). */
  need: number;
  /** Current progress. */
  have: number;
  /** Unit phrase, e.g. `films rated ★3.5+`, `loved films (★4.5+)`, `seen films`. */
  unit: string;
  /** Primary action; defaults to the Ledger. */
  cta?: { label: string; href: string };
  /** Show the "…or import your Letterboxd history →" secondary link (default true). */
  showImport?: boolean;
  /** Optional extra honest copy under the meter. */
  children?: ReactNode;
}) {
  const pct = need > 0 ? Math.max(0, Math.min(100, Math.round((have / need) * 100))) : 0;
  const action = cta ?? { label: STR.forming.defaultCta, href: "/room/ledger" };
  return (
    <div className="fcard">
      <div className="fcline">
        <i className="ti ti-hourglass" />
        <span>{STR.forming.line(feature, need, unit, have)}</span>
      </div>
      <div className="fcmeter" role="meter" aria-valuemin={0} aria-valuemax={need} aria-valuenow={Math.min(have, need)}>
        <i style={{ width: `${pct}%` }} />
      </div>
      {children ? <div className="fcnote">{children}</div> : null}
      <div className="fcacts">
        <Link className="fccta" href={action.href}>{action.label}</Link>
        {showImport ? <Link className="fcimp" href="/me/import">{STR.forming.importCta}</Link> : null}
      </div>
    </div>
  );
}
