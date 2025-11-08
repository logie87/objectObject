import { useNavigate } from "react-router-dom";

export default function Topbar(){
  const navigate = useNavigate();
  return (
    <header className="topbar">
      <div className="logo" style={{minWidth:180}}>
        <div className="logo-badge" />
        <div>Instructive</div>
      </div>

      <div className="search">
        <input placeholder="Search outcomes, activities, IEPs, reports (not implemented)" />
        <kbd style={{fontSize:12,color:"#6b7280"}}>⌘K</kbd>
      </div>

      <div style={{display:"flex", gap:10, marginLeft:"auto"}}>
        <button className="btn flat" aria-label="Settings">Settings</button>
        <button className="btn flat" onClick={()=>navigate("/", {replace:true})} aria-label="Logout">Logout</button>
      </div>
    </header>
  );
}
