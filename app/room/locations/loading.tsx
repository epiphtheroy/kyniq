/** Skeleton for /room/locations — hero + KPI strip + map plane (ghost pulse). */
export default function Loading() {
  return (
    <div className="mainpad">
      <div className="ghline w40" style={{ height: 18 }} />
      <div className="ghline w80" />
      <div className="ghblock" style={{ height: 150, marginTop: 14, marginBottom: 13 }} />
      <div className="at-kpis">
        {[0, 1, 2, 3].map((i) => <div key={i} className="ghblock" style={{ height: 74 }} />)}
      </div>
      <div className="mod ghost">
        <div className="modbody">
          <div className="ghblock" style={{ height: 300 }} />
        </div>
      </div>
      <div className="mod ghost">
        <div className="modbody">
          <div className="ghline w60" />
          <div className="ghline w80" />
          <div className="ghline w40" />
        </div>
      </div>
    </div>
  );
}
