export default function ReportsPage(){
  return (
    <div>
      <div className="header">
        <h1>Reports</h1>
        <div className="sub">Class Alignment • Student IEP Alignment • Outcome Gap Map</div>
      </div>

      <div className="grid files">
        {["Class Alignment Snapshot","Student IEP Alignment (1-pager)","Outcome Gap Map"].map((name,i)=>(
          <div key={i} className="card">
            <div style={{fontWeight:800, fontSize:18, marginBottom:6}}>{name}</div>
            <div style={{color:"var(--muted)", marginBottom:12}}>Preview not implemented.</div>
            <div style={{display:"flex", gap:8}}>
              <button className="btn ghost">Open</button>
              <button className="btn primary">Export PDF</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
