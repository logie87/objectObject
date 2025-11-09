import { useAuth } from '../../context/AuthContext';

export default function Topbar(){
  const { logout } = useAuth();

  return (
    // align with the sidebar by reserving a left column equal to the sidebar width (260px)
    <header
      className="topbar"
      style={{
        display: "grid",
        gridTemplateColumns: "235px 1fr",
        alignItems: "center",
        gap: 12,
      }}
    >
      {/* left column: sits directly above the sidebar */}
      <div className="logo" style={{ minWidth: 180 }}>
        <img
          src="/icon.png" // served from public/
          alt="instructive logo"
          className="logo-img"
        />
        <div>Instructive</div>
      </div>

      {/* right column: content area-aligned */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          className="search"
          // override the global margins so it aligns with the content area
          style={{ margin: 0, flex: 1 }}
        >
          <input placeholder="Search outcomes, activities, IEPs, reports (not implemented)" />
          <kbd style={{ fontSize: 12, color: "#6b7280" }}>⌘K</kbd>
        </div>

        <div style={{ display: "flex", gap: 10, marginLeft: "auto" }}>
          <button className="btn flat" aria-label="Settings">Settings</button>
          <button
            className="btn flat"
            onClick={ logout }
            aria-label="Logout"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
