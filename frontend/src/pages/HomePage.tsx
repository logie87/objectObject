export default function HomePage(){
  return (
    <div>
      <div className="header">
        <h1>Welcome</h1>
        <div className="sub">Quick Align • Summary • Top Gaps</div>
      </div>

      {/* Quick Align */}
      <div className="grid" style={{gridTemplateColumns:"repeat(3, minmax(240px, 1fr))", marginBottom:24}}>
        <button className="card" style={{textAlign:"left"}}>
          <div style={{fontWeight:700, fontSize:18, marginBottom:6}}>Pick Unit / Upload</div>
          <div style={{color:"var(--muted)"}}>Select curriculum unit or upload worksheet(s)</div>
        </button>
        <button className="card" style={{textAlign:"left"}}>
          <div style={{fontWeight:700, fontSize:18, marginBottom:6}}>Choose Students / Group</div>
          <div style={{color:"var(--muted)"}}>Pick class or IEP subset</div>
        </button>
        <button className="card" style={{textAlign:"left"}}>
          <div style={{fontWeight:700, fontSize:18, marginBottom:6}}>Run Alignment</div>
          <div style={{color:"var(--muted)"}}>Local RAG + multi-agent consensus</div>
        </button>
      </div>

      {/* Main split: summary + panel */}
      <div className="panel" style={{padding:20}}>
        <div style={{display:"grid", gridTemplateColumns:"1fr 360px", gap:20}}>
          <div className="grid" style={{gridTemplateColumns:"1fr", gap:16}}>
            {/* Alignment snapshot */}
            <div style={{marginLeft: 10, marginBottom: 10}}>
              <div style={{fontWeight:700, marginBottom:10}}>Alignment Snapshot</div>
              <div style={{display:"flex", gap:8, alignItems:"center", flexWrap:"wrap"}}>
                <span className="badge good">▲ Good • 82%</span>
                <span className="badge warn">■ At-risk • 14%</span>
                <span className="badge bad">● Gap • 4%</span>
                <span style={{marginLeft:"auto", fontSize:12, color:"var(--muted)"}}>Last run: just now</span>
              </div>
            </div>

            {/* Recent runs */}
            <div style={{marginLeft: 10}}>
              <div style={{fontWeight:700, marginBottom:10}}>Recent Runs</div>
              {[1,2,3].map(i=>(
                <div key={i} style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:12,alignItems:"center",padding:"10px 0",borderTop:i===1?"none":"1px solid #eef2f7"}}>
                  <div>Unit {i}: Fractions – Period {i}</div>
                  <div><span className="badge good">▲ {80+i}%</span></div>
                  <button className="btn ghost">Open</button>
                </div>
              ))}
            </div>

            {/* Shortcuts */}
            <div style={{marginLeft: 10}}>
              <div style={{fontWeight:700, marginBottom:10}}>Shortcuts</div>
              <div style={{display:"flex", gap:10, flexWrap:"wrap"}}>
                <button className="btn flat">Upload Worksheet</button>
                <button className="btn flat">New Student Group</button>
                <button className="btn flat">View Reports</button>
                <button className="btn flat">Open Library</button>
              </div>
            </div>
          </div>

          {/* Right panel: consensus preview */}
          <aside style={{position:"sticky", top:0}}>
            <div style={{fontWeight:800, fontSize:18, marginBottom:8}}>Consensus Adaptation</div>
            <div style={{color:"var(--muted)", marginBottom:12}}>Rationale + evidence snippets</div>
              Provide TTS version, scaffold steps, alternate oral assessment, time 1.5×.
              <div style={{marginTop:8,fontSize:12,color:"var(--muted)"}}>
                Evidence: IEP accommodations; activity reading load; prior performance.
              </div>
                  <div style={{display:"flex", gap:12, marginTop: 14}}>
                  <button className="btn primary">Insert into lesson</button>
                  <button className="btn ghost">Copy</button>
              </div>

            {/* Quick tips */}
              <div style={{fontWeight:700, marginTop: 20}}>Quick Tips</div>
              <ul style={{margin:"0 0 0 18px", padding:0}}>
                <li>Use the Library for BC guidelines before running alignment.</li>
                <li>Filters in Curriculum require a re-run to refresh badges.</li>
                <li>Student view → one-click Generate pulls evidence into the panel.</li>
              </ul>
          </aside>
        </div>
      </div>
    </div>
  );
}
