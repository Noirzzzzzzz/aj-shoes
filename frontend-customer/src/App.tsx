// App.tsx — PATCH (ready-to-replace เฉพาะส่วน Routes)
import { Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Search from "./pages/Search";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import Addresses from "./pages/Addresses";
import Favorites from "./pages/Favorites";
import Cart from "./pages/Cart";
import Orders from "./pages/Orders";
import Chat from "./pages/Chat";
import { AuthProvider } from "./context/AuthContext";
import { Toaster } from "react-hot-toast";
import ProductReviews from "./pages/ProductReviews";
import CouponCenter from "./pages/CouponCenter";
import Brand from "./pages/Brand";
import Categorys from "./pages/Categorys";

export default function App() {
  return (
    <AuthProvider>
      <div className="min-h-dvh bg-zinc-950 text-zinc-100">
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/addresses" element={<Addresses />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/chat" element={<Chat />} />

          {/* หน้าใหม่ */}
          <Route path="/coupons" element={<CouponCenter />} />
          <Route path="/product/:id/reviews" element={<ProductReviews />} />

          {/* ✅ รองรับทั้งเอกพจน์และพหูพจน์ */}
          <Route path="/brand" element={<Brand />} />
          <Route path="/brands" element={<Navigate to="/brand" replace />} />

          <Route path="/category" element={<Categorys />} />
          <Route path="/categories" element={<Navigate to="/category" replace />} />

          {/* ไว้ท้ายสุดเสมอ */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster position="top-right" />
      </div>
    </AuthProvider>
  );
}
