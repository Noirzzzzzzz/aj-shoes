import { Link, NavLink } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import SearchControl from "@/components/SearchControl";
import { FaShoppingCart, FaComments } from "react-icons/fa";
import { IoPerson } from "react-icons/io5";
import NotificationBell from "@/components/NotificationBell";

export default function Navbar() {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur border-b border-zinc-800">
      <div className="mx-auto max-w-7xl px-4 h-14 flex items-center gap-4">
        <Link to="/" className="font-extrabold text-xl tracking-wide text-brand-primary">
          AJ Shoes
        </Link>

        <nav className="flex items-center gap-4 text-sm">
          <NavLink to="/" className="hover:text-brand-primary">{"หน้าหลัก"}</NavLink>
          <NavLink to="/brand" className="hover:text-brand-primary">{"แบรนด์"}</NavLink>
          <NavLink to="/category" className="hover:text-brand-primary">{"หมวดหมู่"}</NavLink>
          <NavLink to="/favorites" className="hover:text-brand-primary">{"รายการโปรด"}</NavLink>

          {/* คูปองคงเดิม */}
          <NavLink to="/coupons" className="hover:text-brand-primary">{"ส่วนลด"}</NavLink>
        </nav>

        <div className="ml-auto h-14 flex items-center gap-3">
          <SearchControl />
          {/* Cart ไอคอน */}
          <NavLink to="/cart" className="relative rounded-2xl p-2 hover:bg-neutral-800" aria-label="ตะกร้า">
            <FaShoppingCart className="text-lg" />
          </NavLink>
          {/* แชทเป็นไอคอน */}
          <NavLink to="/chat" className="relative rounded-2xl p-2 hover:bg-neutral-800" aria-label="แชท">
            <FaComments className="text-lg" />
          </NavLink>
          <NotificationBell />
          {user ? (
            <NavLink to="/profile" className="relative rounded-2xl p-2 hover:bg-neutral-800" aria-label="โปรไฟล์">
              <IoPerson className="text-lg" />
            </NavLink>
          ) : (
            <div className="flex items-center gap-2">
              <NavLink to="/login" className="hover:text-brand-primary">{"เข้าสู่ระบบ"}</NavLink>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
