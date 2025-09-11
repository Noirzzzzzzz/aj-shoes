import { FormEvent, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      await register({ username, email, password });
      nav("/");
    } catch (e: any) {
      setErr("Register failed");
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-xl font-bold mb-4">{t("register")}</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="username"
          className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2" />
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="email"
          className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2" />
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="password"
          className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2" />
        {err && <div className="text-red-400 text-sm">{err}</div>}
        <button className="w-full px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500">{t("register")}</button>
      </form>
    </main>
  );
}
