import { FormEvent, useState } from "react";
import { useAuth } from "@/auth";
import { useLocation, useNavigate } from "react-router-dom";

export default function Login(){
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as any;
  const [u,setU] = useState(""); const [p,setP] = useState(""); const [err,setErr]=useState("");

  async function onSubmit(e:FormEvent){
    e.preventDefault();
    setErr("");
    try{ await login(u,p); nav(loc.state?.from || "/"); }catch{ setErr("Invalid credentials"); }
  }
  return (
    <main className="mx-auto max-w-sm px-4 py-10">
      <h1 className="text-xl font-bold mb-4">Admin Login</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input value={u} onChange={e=>setU(e.target.value)} placeholder="username" className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2" />
        <input type="password" value={p} onChange={e=>setP(e.target.value)} placeholder="password" className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2" />
        {err && <div className="text-red-400 text-sm">{err}</div>}
        <button className="w-full px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500">Login</button>
      </form>
    </main>
  );
}
