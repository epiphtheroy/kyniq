/** Slate skeleton — title, KPI and deal-flow ghosts (.ghline / .mod.ghost pulse). */
export default function LoadingSlate() {
  return (
    <div className="v2wrap">
      <div>
        <div className="ghline w40" style={{ height: 20 }} />
        <div className="ghline w60" />
      </div>
      <div>
        <div className="ghline w40" />
        <div className="mod ghost"><div className="modbody" /></div>
        <div className="mod ghost"><div className="modbody" /></div>
      </div>
    </div>
  );
}
