import { useEffect, useState } from "react";
import api from "@/api";
import toast from "react-hot-toast";

type User = { id:number; username:string; email:string; role:"superadmin"|"subadmin"|"customer"; is_active:boolean };

export default function Users(){
  const [list,setList] = useState<User[]>([]);
  async function load(){
    const { data } = await api.get("/api/admin/users/");
    setList(data);
  }
  useEffect(()=>{ load(); }, []);

  async function setRole(u:User, role:User["role"]){
    const { data } = await api.post(`/api/admin/users/${u.id}/set_role/`, { role });
    setList(list.map(x=>x.id===u.id?data:x));
    toast.success("Role updated");
  }
  async function toggleActive(u:User){
    const { data } = await api.post(`/api/admin/users/${u.id}/set_active/`, { is_active: !u.is_active });
    setList(list.map(x=>x.id===u.id?data:x));
    toast.success(data.is_active ? "Unbanned" : "Banned");
  }
  async function reset(u:User){
    const { data } = await api.post(`/api/admin/users/${u.id}/reset_password/`);
    navigator.clipboard.writeText(data.temp_password);
    toast.success("Temp password copied to clipboard");
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 space-y-4">
      <h1 className="text-xl font-bold">Users</h1>
      <div className="grid gap-2">
        {list.map(u => (
          <div key={u.id} className="p-3 rounded border border-zinc-800 bg-zinc-900 flex items-center gap-3">
            <div className="font-semibold">#{u.id} {u.username}</div>
            <div className="text-xs text-zinc-400">{u.email}</div>
            <select value={u.role} onChange={e=>setRole(u, e.target.value as any)} className="ml-auto bg-zinc-900 border border-zinc-700 rounded px-2 py-1">
              <option value="customer">customer</option>
              <option value="subadmin">subadmin</option>
              <option value="superadmin">superadmin</option>
            </select>
            <button onClick={()=>toggleActive(u)} className={`text-xs px-2 py-1 rounded ${u.is_active?"bg-zinc-800":"bg-red-600"}`}>{u.is_active?"Active":"Banned"}</button>
            <button onClick={()=>reset(u)} className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700">Reset PW</button>
          </div>
        ))}
      </div>
    </main>
  );
}
