/** Desk skeleton — mirrors the five bands (log bar / tonight hero / session
 *  tape / NAV line / open jobs) so the loaded page lands without layout shift. */
export default function Loading() {
  return (
    <div className="v2wrap" style={{ gap: 22, paddingBottom: 40 }}>
      <div className="ghblock" style={{ height: 46 }} />
      <div className="ghblock" style={{ height: 226 }} />
      <div className="ghblock" style={{ height: 158 }} />
      <div className="ghblock" style={{ height: 48 }} />
      <div className="ghblock" style={{ height: 44 }} />
    </div>
  );
}
