import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Topbar(){
  const { logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = () => {
    logout();           // clear token/state
    navigate('/', { replace: true }); // go to login
  };

  return (
    <header
      className="topbar"
      style={{
        display: "grid",
        gridTemplateColumns: "235px 1fr",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div className="logo" style={{ minWidth: 180 }}>
        <img src="/icon.png" alt="instructive logo" className="logo-img" />
        <div>Instructive</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div className="search" style={{ margin: 0, flex: 1 }}>
          <input placeholder="Search outcomes, activities, IEPs, reports (not implemented)" />
          <kbd style={{ fontSize: 12, color: "#6b7280" }}>⌘K</kbd>
        </div>

        <div style={{ display: "flex", gap: 10, marginLeft: "auto" }}>
          <button className="btn flat" aria-label="Settings">Settings</button>
          <button className="btn flat" onClick={onLogout} aria-label="Logout">
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
