// Navbar.tsx — READY TO REPLACE
import { Link, NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ThemeToggle from "./ThemeToggle";
import LanguageToggle from "./LanguageToggle";
import { useAuth } from "@/context/AuthContext";
import SearchControl from "@/components/SearchControl";
import { FaShoppingCart } from "react-icons/fa";

export default function Navbar() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur border-b border-zinc-800">
      <div className="mx-auto max-w-7xl px-4 h-14 flex items-center gap-4">
        <Link to="/" className="font-extrabold text-xl tracking-wide text-brand-primary">
          AJ Shoes
        </Link>

        <nav className="flex items-center gap-4 text-sm">
          <NavLink to="/" className="hover:text-brand-primary">{t("home")}</NavLink>
          <NavLink to="/favorites" className="hover:text-brand-primary">{t("Favorites")}</NavLink>
          <NavLink to="/orders" className="hover:text-brand-primary">{t("orders")}</NavLink>
          <NavLink to="/chat" className="hover:text-brand-primary">{t("chat")}</NavLink>
          {/* ✅ เพิ่มเมนู Coupons */}
          <NavLink to="/coupons" className="hover:text-brand-primary">{t("Coupons")}</NavLink>
        </nav>

        <div className="ml-auto h-14 flex items-center gap-3">
          <SearchControl />
          <NavLink to="/cart" className="hover:text-brand-primary flex items-center gap-1">
            <FaShoppingCart className="text-lg" />
          </NavLink>
          <LanguageToggle />
          {user ? (
            <div className="flex items-center gap-2">
              <NavLink to="/profile" className="hover:text-brand-primary">{t("profile")}</NavLink>
              <button onClick={logout} className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700">
                {t("logout")}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <NavLink to="/login" className="hover:text-brand-primary">{t("login")}</NavLink>
              <NavLink to="/register" className="hover:text-brand-primary">{t("register")}</NavLink>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
