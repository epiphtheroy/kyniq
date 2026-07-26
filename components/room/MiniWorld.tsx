"use client";
/** MiniWorld — the desk's world-map preview (마이룸-v4 §4.1: show, don't link).
 *  Same projection and land paths as LocationsWorkspace (equirectangular:
 *  x=(lng+180)/360·760, y=(90−lat)/180·380), no interactions beyond the wrap
 *  link into /room/locations. Light palette per v4 token mapping. */
import Link from "next/link";
import { WORLD_LAND_PATHS, WORLD_VIEW_W, WORLD_VIEW_H } from "@/lib/room/world_paths";
import type { GeoDot } from "./DeskWorkspace";

const px = (lng: number) => ((lng + 180) / 360) * WORLD_VIEW_W;
const py = (lat: number) => ((90 - lat) / 180) * WORLD_VIEW_H;

export default function MiniWorld({ dots }: { dots: GeoDot[] }) {
  return (
    <Link href="/room/locations" className="mw-wrap" title="Open the world map">
      <svg viewBox={`0 0 ${WORLD_VIEW_W} ${WORLD_VIEW_H}`} className="mw-svg" aria-label="Your film world map">
        <rect x="0" y="0" width={WORLD_VIEW_W} height={WORLD_VIEW_H} fill="#F3EFE6" />
        {WORLD_LAND_PATHS.map((d, i) => (
          <path key={i} d={d} fill="#E2DCCB" stroke="#CFC8B4" strokeWidth="0.6" />
        ))}
        {dots.map((p, i) => (
          <circle key={i} cx={px(p.o)} cy={py(p.a)} r={2.6}
            fill={p.s ? "#1F6BB8" : "#E3120B"} fillOpacity={0.85} stroke="#FFFFFF" strokeWidth={0.7} />
        ))}
      </svg>
    </Link>
  );
}
