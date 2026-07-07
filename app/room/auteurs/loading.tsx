/** Skeleton for /room/auteurs — KPI strip + two list modules (ghost pulse). */
export default function Loading() {
  return (
    <div className="mainpad">
      <div className="ghline w40" style={{ height: 18 }} />
      <div className="ghline w80" />
      <div className="au-kpis" style={{ marginTop: 14 }}>
        {[0, 1, 2, 3].map((i) => <div key={i} className="ghblock" style={{ height: 74 }} />)}
      </div>
      <div className="mod ghost">
        <div className="modbody">
          <div className="ghline w60" />
          <div className="ghline w80" />
          <div className="ghline w80" />
          <div className="ghline w60" />
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
