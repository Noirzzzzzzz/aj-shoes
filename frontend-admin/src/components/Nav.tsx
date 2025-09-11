import { Link, NavLink } from "react-router-dom";
import { useAuth } from "@/auth";

export default function Nav(){
  const { user, logout } = useAuth();
  return (
    <header className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur border-b border-zinc-800">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-4">
        <Link to="/" className="font-extrabold text-xl tracking-wide text-brand-primary">AJ Shoes Admin</Link>
        <nav className="flex items-center gap-4 text-sm">
          <NavLink to="/" className="hover:text-brand-primary">Dashboard</NavLink>
          <NavLink to="/products" className="hover:text-brand-primary">Products</NavLink>
          <NavLink to="/coupons" className="hover:text-brand-primary">Coupons</NavLink>
          <NavLink to="/users" className="hover:text-brand-primary">Users</NavLink>
          <NavLink to="/chat" className="hover:text-brand-primary">Chat</NavLink>
        </nav>
        <div className="ml-auto">{user && (
          <div className="flex items-center gap-3">
            <span className="text-xs bg-zinc-800 px-2 py-1 rounded">{user.username} ({user.role})</span>
            <button onClick={logout} className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700">Logout</button>
          </div>
        )}</div>
      </div>
    </header>
  );
}
