/** Route skeleton — ghost blocks while the ledger loads (spec §4 Loading/Error). */
export default function LedgerLoading() {
  return (
    <div className="v2wrap">
      <div>
        <div className="ghline w40" />
        <div className="ghline w60" />
      </div>
      <div className="ghblock" style={{ height: 48 }} />
      <div className="ghblock" style={{ height: 92 }} />
      <div className="ghblock" style={{ height: 150 }} />
      <div className="ghblock" style={{ height: 420 }} />
    </div>
  );
}
