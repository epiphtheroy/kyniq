/** Route skeleton for /room/masquerade — ghost of the single masquerade card. */
export default function Loading() {
  return (
    <div className="mainpad">
      <div className="ghline w40" />
      <div className="ghline w80" />
      <div className="mod ghost" style={{ maxWidth: 620, margin: "14px auto 0" }}>
        <div className="modbody">
          <div className="ghline w60" />
          <div className="ghline w40" />
          <div className="ghline w80" />
        </div>
      </div>
    </div>
  );
}
