/** Inspector primitive — one key/value line (.kv). Value renders mono/bright. */
import type { ReactNode } from "react";

export default function KV({ k, v, title }: { k: ReactNode; v: ReactNode; title?: string }) {
  return (
    <div className="kv" title={title}>
      <span>{k}</span>
      <b>{v}</b>
    </div>
  );
}
