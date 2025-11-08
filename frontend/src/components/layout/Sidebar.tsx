import { NavLink } from "react-router-dom";

function Icon({d}:{d:string}) {
  return (
    <svg className="icon-24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d}/>
    </svg>
  );
}

const items = [
  { to: "/app/home", label: "Home", d: "M3 12l9-9 9 9v8a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2v-8z" },
  { to: "/app/curriculum", label: "Curriculum", d: "M4 4h16v4H4zM4 10h16v10H4z" },
  { to: "/app/students", label: "Students", d: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z M6 21v-1a6 6 0 0 1 12 0v1" },
  { to: "/app/reports", label: "Reports", d: "M3 3h18v14H3z M7 21h10" },
  { to: "/app/library", label: "Library", d: "M4 5h16v14H4z M8 9h8 M8 13h6" },
];

export default function Sidebar(){
  return (
    <aside className="sidebar">
      <nav style={{display:"grid", gap:8}}>
        {items.map(it=>(
          <NavLink key={it.to} to={it.to} end>
            {({isActive})=>(
              <button className={`nav-btn ${isActive ? "active":""}`}>
                <Icon d={it.d}/>
                <span className="nav-label">{it.label}</span>
              </button>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
