import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function MainLayout(){
  return (
    <div className="app-shell">
      <Topbar />
      <Sidebar />
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
