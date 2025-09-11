import React, { createContext, useContext, useEffect, useState } from "react";
import api, { clearTokens, setTokens } from "./api";

type User = { id:number; username:string; role:"superadmin"|"subadmin"|"customer"; is_active?:boolean };
type AuthCtx = { user:User|null; loading:boolean; login:(u:string,p:string)=>Promise<void>; logout:()=>void; };
const Ctx = createContext<AuthCtx>(null!);

export function AuthProvider({children}:{children:React.ReactNode}){
  const [user,setUser] = useState<User|null>(null);
  const [loading,setLoading] = useState(true);
  async function fetchMe(){
    try{ const {data} = await api.get("/api/accounts/me/"); setUser(data); }catch{ setUser(null); } finally{ setLoading(false); }
  }
  useEffect(()=>{ fetchMe(); },[]);
  async function login(username:string, password:string){
    const { data } = await api.post("/api/auth/token/", { username, password });
    setTokens(data.access, data.refresh);
    await fetchMe();
  }
  function logout(){ clearTokens(); setUser(null); }
  return <Ctx.Provider value={{user,loading,login,logout}}>{children}</Ctx.Provider>;
}
export function useAuth(){ return useContext(Ctx); }
