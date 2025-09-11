import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./auth";
import Nav from "./components/Nav";
import { RequireAuth, RequireSuperadmin } from "./components/Guard";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Coupons from "./pages/Coupons";
import Users from "./pages/Users";
import Chat from "./pages/Chat";
import { Toaster } from "react-hot-toast";

export default function App(){
  return (
    <AuthProvider>
      <div className="min-h-dvh bg-zinc-950 text-zinc-100">
        <Nav />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/products" element={<RequireSuperadmin><Products /></RequireSuperadmin>} />
          <Route path="/coupons" element={<RequireSuperadmin><Coupons /></RequireSuperadmin>} />
          <Route path="/users" element={<RequireSuperadmin><Users /></RequireSuperadmin>} />
          <Route path="/chat" element={<RequireAuth><Chat /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
        <Toaster position="top-right" />
      </div>
    </AuthProvider>
  );
}
