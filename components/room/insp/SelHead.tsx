/** Inspector primitive — selection header (.selhead): poster + serif title + sub.
 *  Pass href to make the title a link (e.g. to the Appraisal card). */
import Link from "next/link";
import type { ReactNode } from "react";
import { IMG } from "@/lib/room/format";

export default function SelHead({ title, sub, posterPath, href }: {
  title: ReactNode;
  sub?: ReactNode;
  posterPath?: string | null;
  href?: string;
}) {
  return (
    <div className="selhead">
      <span className="po" style={posterPath ? { backgroundImage: `url(${IMG}${posterPath})` } : {}} />
      <div style={{ minWidth: 0 }}>
        <div className="seltitle ser">{href ? <Link href={href}>{title}</Link> : title}</div>
        {sub != null ? <div className="selsub">{sub}</div> : null}
      </div>
    </div>
  );
}
