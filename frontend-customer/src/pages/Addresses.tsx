import { useEffect, useState } from "react";
import api from "@/api/client";
import Protected from "@/components/Protected";

type Address = { id:number; full_name:string; phone:string; address:string; province:string; postal_code:string };

export default function Addresses() {
  return (
    <Protected><AddressesInner /></Protected>
  );
}
function AddressesInner() {
  const [list, setList] = useState<Address[]>([]);
  const [form, setForm] = useState<Address>({ id:0, full_name:"", phone:"", address:"", province:"", postal_code:"" });

  async function load() {
    const { data } = await api.get("/api/orders/addresses/");
    setList(data);
  }
  useEffect(()=>{ load(); }, []);

  async function save() {
    await api.post("/api/orders/addresses/", form);
    setForm({ id:0, full_name:"", phone:"", address:"", province:"", postal_code:"" });
    await load();
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 space-y-4">
      <h1 className="text-xl font-bold">Addresses</h1>
      <div className="grid gap-2">
        {list.map(a => (
          <div key={a.id} className="p-3 rounded border border-zinc-800 bg-zinc-900">
            <div className="font-semibold">{a.full_name} ({a.phone})</div>
            <div className="text-sm text-zinc-300">{a.address}, {a.province} {a.postal_code}</div>
          </div>
        ))}
      </div>

      <div className="p-4 rounded border border-zinc-800 bg-zinc-900 space-y-2">
        <h2 className="font-semibold">Add Address</h2>
        <div className="grid sm:grid-cols-2 gap-2">
          <input className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1" placeholder="Full name" value={form.full_name} onChange={e=>setForm({...form, full_name:e.target.value})} />
          <input className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1" placeholder="Phone" value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} />
          <input className="sm:col-span-2 bg-zinc-900 border border-zinc-700 rounded px-2 py-1" placeholder="Address" value={form.address} onChange={e=>setForm({...form, address:e.target.value})} />
          <input className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1" placeholder="Province" value={form.province} onChange={e=>setForm({...form, province:e.target.value})} />
          <input className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1" placeholder="Postal code" value={form.postal_code} onChange={e=>setForm({...form, postal_code:e.target.value})} />
        </div>
        <button onClick={save} className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500">Save</button>
      </div>
    </main>
  );
}
