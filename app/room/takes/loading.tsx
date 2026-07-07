/** /room/takes loading skeleton — composer ghost (list rail + editor). */
export default function Loading() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "262px minmax(0,1fr)", gap: 0, height: "100%" }}>
      <div style={{ borderRight: "1px solid var(--line2)", padding: 12 }}>
        <div className="ghblock" style={{ height: 30, marginBottom: 12 }} />
        <div className="ghline w80" />
        <div className="ghline w60" />
        <div className="ghline w80" />
        <div className="ghline w40" />
      </div>
      <div style={{ padding: "24px 30px" }}>
        <div className="ghline w40" style={{ height: 26 }} />
        <div className="ghline w80" />
        <div className="ghline w80" />
        <div className="ghline w60" />
        <div className="ghblock" style={{ height: 220, marginTop: 16 }} />
      </div>
    </div>
  );
}
