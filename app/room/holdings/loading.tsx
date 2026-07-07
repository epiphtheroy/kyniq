/** Route skeleton — ghost blocks while the positions table loads (spec §4). */
export default function HoldingsLoading() {
  return (
    <div className="v2wrap">
      <div>
        <div className="ghline w40" />
        <div className="ghline w60" />
      </div>
      <div className="ghblock" style={{ height: 40 }} />
      <div className="ghblock" style={{ height: 520 }} />
    </div>
  );
}
