import { Link, NavLink } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";
import { useAuth } from "@/context/AuthContext";
import SearchControl from "@/components/SearchControl";
import { FaShoppingCart, FaComments } from "react-icons/fa";
import { IoPerson } from "react-icons/io5";

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
          <NavLink to="/favorites" className="hover:text-brand-primary">{"รายการโปรด"}</NavLink>

          {/* คูปองคงเดิม */}
          <NavLink to="/coupons" className="hover:text-brand-primary">{"ส่วนลด"}</NavLink>
        </nav>

        <div className="ml-auto h-14 flex items-center gap-3">
          <SearchControl />

          {/* Cart ไอคอน */}
          <NavLink to="/cart" className="hover:text-brand-primary flex items-center" aria-label="ตะกร้า">
            <FaShoppingCart className="text-lg" />
          </NavLink>

          {/* แชทเป็นไอคอน */}
          <NavLink to="/chat" className="hover:text-brand-primary flex items-center" aria-label="แชท">
            <FaComments className="text-lg" />
          </NavLink>

          {user ? (
            // โปรไฟล์เป็นไอคอน 3 ขีด และเอา logout ออกจาก navbar
            <NavLink to="/profile" className="hover:text-brand-primary flex items-center" aria-label="โปรไฟล์">
              <IoPerson className="text-lg" />
            </NavLink>
          ) : (
            <div className="flex items-center gap-2">
              <NavLink to="/login" className="hover:text-brand-primary">{"เข้าสู่ระบบ"}</NavLink>
              <NavLink to="/register" className="hover:text-brand-primary">{"สมัครสมาชิก"}</NavLink>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
