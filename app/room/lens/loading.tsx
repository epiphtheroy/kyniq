/** Lens — route skeleton (tab bar + panel ghosts). The workspace itself is
 *  client-fetch-first, so this only covers the route-level chunk load. */
export default function LensLoading() {
  return (
    <div className="mainpad">
      <div className="ghline w40" />
      <div className="ghline w80" />
      <div style={{ display: "flex", gap: 6, margin: "14px 0" }}>
        <div className="ghblock" style={{ width: 90, height: 30, borderRadius: 999 }} />
        <div className="ghblock" style={{ width: 100, height: 30, borderRadius: 999 }} />
        <div className="ghblock" style={{ width: 96, height: 30, borderRadius: 999 }} />
        <div className="ghblock" style={{ width: 104, height: 30, borderRadius: 999 }} />
      </div>
      <div className="mod ghost"><div className="modbody" style={{ minHeight: 320 }} /></div>
      <div className="mod ghost"><div className="modbody" /></div>
    </div>
  );
}
