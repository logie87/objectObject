import { Outlet } from "react-router-dom";

export default function MainLayout() {
  return (
    <div>
      <header>Header</header>
      <Outlet /> {/* Page content goes here */}
      <footer>Footer</footer>
    </div>
  );
}
