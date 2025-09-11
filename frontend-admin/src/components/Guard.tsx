import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/auth";

export function RequireAuth({children}:{children:JSX.Element}){
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="p-6">Loading...</div>;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  return children;
}

export function RequireSuperadmin({children}:{children:JSX.Element}){
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="p-6">Loading...</div>;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (user.role !== "superadmin") return <Navigate to="/chat" replace />;
  return children;
}
