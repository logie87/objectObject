const docs = [
  "BC-Adaptations-Guidelines-Reading.pdf",
  "BC-Universal-Design-for-Learning-Overview.pdf",
  "BC-Assessment-Accommodations-K-12.pdf",
  "BC-IEP-Planning-Template.docx",
  "BC-Assistive-Technology-Quick-Ref.pdf",
  "BC-Executive-Function-Supports.pdf",
  "BC-ELL-Adjustment-Guidelines.pdf",
  "BC-Math-Alternate-Pathways.pdf",
  "BC-Behavior-Support-Strategies.pdf",
  "BC-Transition-Planning-Checklist.pdf",
];

export default function LibraryPage(){
  return (
    <div>
      <div className="header">
        <h1>Library</h1>
        <div className="sub">Ingested curriculum & guidance documents</div>
      </div>

      <div className="grid files">
        {docs.map((name,i)=>(
          <div key={i} className="card">
            <div style={{display:"flex", alignItems:"center", gap:10, marginBottom:10}}>
              <div style={{width:48, height:48, borderRadius:16, background:"#ecfeff"}} />
              <div>
                <div style={{fontWeight:700}}>{name}</div>
                <div style={{color:"var(--muted)"}}>Added recently</div>
              </div>
            </div>
            <div style={{display:"flex", gap:8}}>
              <button className="btn ghost">View</button>
              <button className="btn primary">Analyze</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
