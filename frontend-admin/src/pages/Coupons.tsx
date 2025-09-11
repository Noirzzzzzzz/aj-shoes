import { useEffect, useState } from "react";
import api from "@/api";
import toast from "react-hot-toast";

type Coupon = { id:number; code:string; discount_type:"percent"|"free_shipping"; percent_off:number; min_spend:number|string; max_uses:number; uses_count:number; valid_from:string; valid_to:string|null };

export default function Coupons(){
  const [list,setList] = useState<Coupon[]>([]);
  const [form,setForm] = useState<Coupon>({id:0, code:"", discount_type:"percent", percent_off:10, min_spend:0, max_uses:100, uses_count:0, valid_from:"", valid_to:null});

  async function load(){
    const { data } = await api.get("/api/admin/coupons/");
    setList(data);
  }
  useEffect(()=>{ load(); }, []);

  async function save(){
    if (!form.code){ toast.error("code required"); return; }
    if (form.id===0){
      await api.post("/api/admin/coupons/", form);
      toast.success("Created");
    } else {
      await api.put(`/api/admin/coupons/${form.id}/`, form);
      toast.success("Saved");
    }
    setForm({id:0, code:"", discount_type:"percent", percent_off:10, min_spend:0, max_uses:100, uses_count:0, valid_from:"", valid_to:null});
    await load();
  }
  async function del(id:number){
    await api.delete(`/api/admin/coupons/${id}/`);
    toast.success("Deleted");
    await load();
  }
  async function genRounds(){
    await api.post("/api/admin/coupons/generate_rounds/", {});
    toast.success("Generated");
    await load();
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Coupons</h1>
        <button onClick={genRounds} className="px-3 py-2 rounded bg-zinc-800 hover:bg-zinc-700">Generate free-shipping rounds</button>
      </div>

      <div className="grid md:grid-cols-6 gap-2 p-3 rounded border border-zinc-800 bg-zinc-900">
        <input placeholder="CODE" value={form.code} onChange={e=>setForm({...form, code:e.target.value})} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 md:col-span-2" />
        <select value={form.discount_type} onChange={e=>setForm({...form, discount_type:e.target.value as any})} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1">
          <option value="percent">Percent</option>
          <option value="free_shipping">Free shipping</option>
        </select>
        <input type="number" placeholder="Percent" value={form.percent_off} onChange={e=>setForm({...form, percent_off:Number(e.target.value)})} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1" />
        <input type="number" placeholder="Min spend" value={form.min_spend as any} onChange={e=>setForm({...form, min_spend:Number(e.target.value)})} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1" />
        <input type="number" placeholder="Max uses" value={form.max_uses} onChange={e=>setForm({...form, max_uses:Number(e.target.value)})} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1" />
        <button onClick={save} className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 md:col-span-1">Save</button>
      </div>

      <div className="grid gap-2">
        {list.map(c => (
          <div key={c.id} className="p-3 rounded border border-zinc-800 bg-zinc-900 flex items-center gap-3">
            <div className="font-semibold">{c.code}</div>
            <div className="text-xs text-zinc-400">{c.discount_type} • {c.percent_off}% • min {c.min_spend} • uses {c.uses_count}/{c.max_uses}</div>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={()=>setForm(c)} className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700">Edit</button>
              <button onClick={()=>del(c.id)} className="text-xs px-2 py-1 rounded bg-red-600">Del</button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
