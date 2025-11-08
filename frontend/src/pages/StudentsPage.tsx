export default function StudentsPage(){
  return (
    <div>
      <div className="header">
        <h1>Students</h1>
        <div className="sub">IEP snapshots • Top gaps • One-click adaptations</div>
      </div>

      <div className="grid files">
        {Array.from({length:8}).map((_,i)=>(
          <div key={i} className="card">
            <div style={{display:"flex", alignItems:"center", gap:10, marginBottom:10}}>
              <div style={{width:48, height:48, borderRadius:16, background:"#eef2ff"}} />
              <div>
                <div style={{fontWeight:700}}>Student {i+1}</div>
                <div style={{color:"var(--muted)"}}>Alignment 72%</div>
              </div>
            </div>
            <div style={{display:"flex", gap:6, flexWrap:"wrap", marginBottom:12}}>
              <span className="badge bad">● Reading</span>
              <span className="badge warn">■ Time</span>
            </div>
            <button className="btn primary" style={{width:"100%"}}>Generate Adaptation</button>
          </div>
        ))}
      </div>
    </div>
  );
}
