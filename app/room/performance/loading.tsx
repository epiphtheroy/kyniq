/** /room/performance — route skeleton (spec §4: every route ships loading.tsx).
 *  Ghost shapes mirror the page: hero block → ladder → alpha → movers. */
export default function LoadingPerformance() {
  return (
    <div className="v2wrap">
      <div>
        <div className="ghline w40" />
        <div className="ghline w60" />
      </div>
      <div className="ghblock" style={{ height: 280 }} />
      <div className="mod ghost"><div className="modbody" /></div>
      <div className="mod ghost"><div className="modbody" /></div>
      <div className="mod ghost"><div className="modbody" /></div>
    </div>
  );
}
