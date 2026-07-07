/** Inspector primitive — the standard .icard section (icon + uppercase title +
 *  optional right-aligned meta). Replaces ~20 hand-rolled copies across v2.
 *  Pass DATA through props and rebuild the node from workspace state on change —
 *  inspector content is a rendered snapshot, not a live subscription. */
import type { ReactNode } from "react";

export default function ICard({ icon, title, right, children }: {
  /** Tabler icon class without the "ti " prefix, e.g. "ti-bulb". */
  icon?: string;
  title: ReactNode;
  /** Small right-aligned annotation in the header. */
  right?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="icard">
      <h4>
        {icon ? <i className={`ti ${icon}`} /> : null}
        {title}
        {right != null ? <span className="ihr">{right}</span> : null}
      </h4>
      {children}
    </div>
  );
}
