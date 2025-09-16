// App.tsx — READY TO REPLACE
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
// ✅ import หน้าใหม่
import CouponCenter from "./pages/CouponCenter";

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
          {/* ✅ เส้นทางใหม่ */}
          <Route path="/coupons" element={<CouponCenter />} />
          <Route path="/product/:id/reviews" element={<ProductReviews />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
        <Toaster position="top-right" />
      </div>
    </AuthProvider>
  );
}
