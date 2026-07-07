/** /room/shelf loading skeleton — header + KPI + card-grid ghosts. */
export default function Loading() {
  return (
    <div className="mainpad">
      <div className="ghline w40" style={{ height: 22, margin: "6px 0 10px" }} />
      <div className="ghline w60" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, margin: "14px 0 16px" }}>
        <div className="ghblock" style={{ height: 68 }} />
        <div className="ghblock" style={{ height: 68 }} />
        <div className="ghblock" style={{ height: 68 }} />
        <div className="ghblock" style={{ height: 68 }} />
      </div>
      <div className="mod ghost" style={{ minHeight: 320 }}>
        <div className="modbody">
          <div className="ghline w80" />
          <div className="ghline w60" />
          <div className="ghline w80" />
        </div>
      </div>
    </div>
  );
}
