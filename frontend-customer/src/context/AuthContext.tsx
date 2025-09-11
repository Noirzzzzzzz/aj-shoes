import React, { createContext, useContext, useEffect, useState } from "react";
import api, { clearTokens, setTokens } from "@/api/client";
import { User } from "@/types";

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (payload: {username: string; email?: string; password: string}) => Promise<void>;
  logout: () => void;
};
const Ctx = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchMe() {
    try {
      const { data } = await api.get("/api/accounts/me/");
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMe();
  }, []);

  async function login(username: string, password: string) {
    const { data } = await api.post("/api/auth/token/", { username, password });
    setTokens(data.access, data.refresh);
    await fetchMe();
  }

  async function register(p: {username: string; email?: string; password: string}) {
    await api.post("/api/accounts/register/", p);
    await login(p.username, p.password);
  }

  function logout() {
    clearTokens();
    setUser(null);
  }

  return <Ctx.Provider value={{ user, loading, login, register, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() { return useContext(Ctx); }
