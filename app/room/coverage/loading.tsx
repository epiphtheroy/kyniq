/** /room/coverage — route skeleton (spec §4: every route ships loading.tsx).
 *  Ghost shapes mirror the page: tabs line → board → blind spots. */
export default function LoadingCoverage() {
  return (
    <div className="v2wrap">
      <div>
        <div className="ghline w40" />
        <div className="ghline w60" />
      </div>
      <div className="ghline w80" />
      <div className="mod ghost" style={{ minHeight: 260 }}><div className="modbody" /></div>
      <div className="mod ghost"><div className="modbody" /></div>
    </div>
  );
}
