"use client";

/** Excludes this browser from mt_events collection (localStorage flag read by components/Metrics.tsx). */

import { useEffect, useState } from "react";

export default function MetricsOptOut() {
  const [off, setOff] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setOff(localStorage.getItem("mt_optout") === "1");
    } catch {
      setOff(false);
    }
  }, []);

  if (off === null) return null;

  return (
    <button
      onClick={() => {
        try {
          if (off) localStorage.removeItem("mt_optout");
          else localStorage.setItem("mt_optout", "1");
          setOff(!off);
        } catch {}
      }}
      style={{
        background: "transparent",
        border: "1px solid rgba(148,163,184,0.3)",
        borderRadius: 6,
        color: off ? "#0ca30c" : "#94a3b8",
        fontSize: 12,
        padding: "4px 10px",
        cursor: "pointer",
      }}
      title="Sets localStorage.mt_optout in this browser only"
    >
      {off ? "✓ This browser is excluded from tracking" : "Exclude this browser from tracking"}
    </button>
  );
}
