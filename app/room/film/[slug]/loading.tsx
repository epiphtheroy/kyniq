/** Route skeleton for /room/film/[slug] (Appraisal) — ghost hero + module ghosts. */
export default function Loading() {
  return (
    <div className="mainpad ec-wrap">
      <div className="ghline w40" />
      <div className="ghline w60" />
      <div className="ghblock" style={{ height: 44, margin: "12px 0" }} />
      <div className="ghblock" style={{ height: 200, marginBottom: 13 }} />
      <div className="mod ghost">
        <div className="modbody">
          <div className="ghline w60" />
          <div className="ghline w80" />
          <div className="ghline w40" />
        </div>
      </div>
      <div className="mod ghost">
        <div className="modbody">
          <div className="ghline w80" />
          <div className="ghline w60" />
        </div>
      </div>
    </div>
  );
}
