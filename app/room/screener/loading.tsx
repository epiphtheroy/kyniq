/** Screener skeleton — title, control-bar and row ghosts (.ghline / .mod.ghost pulse). */
export default function LoadingScreener() {
  return (
    <div className="v2wrap">
      <div>
        <div className="ghline w40" style={{ height: 20 }} />
        <div className="ghline w60" />
      </div>
      <div>
        <div className="ghline w80" />
        <div className="mod ghost"><div className="modbody" /></div>
        <div className="mod ghost"><div className="modbody" /></div>
      </div>
    </div>
  );
}
