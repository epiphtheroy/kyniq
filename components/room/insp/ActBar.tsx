"use client";
/** Inspector primitive — action bar (.actbar of .actbtn). Buttons or links.
 *  `primary` renders the red primary style; `disabled` renders inert with an
 *  optional title explaining why (honest gating, e.g. "Unpinning ships soon."). */
import Link from "next/link";
import type { ReactNode } from "react";

export type Act = {
  label: ReactNode;
  onClick?: () => void;
  /** Renders a <Link> instead of a button. */
  href?: string;
  primary?: boolean;
  disabled?: boolean;
  title?: string;
};

export default function ActBar({ acts, style }: { acts: Act[]; style?: React.CSSProperties }) {
  return (
    <div className="actbar" style={style}>
      {acts.map((a, i) => {
        const cls = `actbtn${a.primary ? " pri" : ""}${a.disabled ? " dis" : ""}`;
        if (a.href && !a.disabled) {
          return <Link key={i} className={cls} href={a.href} title={a.title}>{a.label}</Link>;
        }
        return (
          <span
            key={i}
            className={cls}
            role="button"
            tabIndex={a.disabled ? -1 : 0}
            aria-disabled={a.disabled || undefined}
            title={a.title}
            onClick={a.disabled ? undefined : a.onClick}
            onKeyDown={a.disabled ? undefined : (e) => { if ((e.key === "Enter" || e.key === " ") && a.onClick) { e.preventDefault(); a.onClick(); } }}
          >
            {a.label}
          </span>
        );
      })}
    </div>
  );
}
