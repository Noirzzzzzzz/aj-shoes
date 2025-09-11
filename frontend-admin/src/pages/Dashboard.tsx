import { useEffect, useMemo, useState } from "react";
import api from "@/api";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Brand = { id:number; name:string };
type Category = { id:number; name:string };
type Coupon = { id:number; code:string };

type SeriesPoint = { label:string; revenue:number; items:number; orders:number };
type TopProduct = { product_id:number; product__name_en:string; qty:number; revenue:number };

export default function Dashboard(){
  const [dateFrom, setDateFrom] = useState<string>(()=> new Date(Date.now()-29*86400000).toISOString().slice(0,10));
  const [dateTo, setDateTo] = useState<string>(()=> new Date().toISOString().slice(0,10));
  const [group, setGroup] = useState<"day"|"week"|"month"|"quarter">("day");
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);

  const [selBrands, setSelBrands] = useState<number[]>([]);
  const [selCats, setSelCats] = useState<number[]>([]);
  const [selCoupons, setSelCoupons] = useState<string[]>([]);

  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [totals, setTotals] = useState<{revenue:number; items:number; orders:number}>({revenue:0,items:0,orders:0});
  const [top, setTop] = useState<TopProduct[]>([]);
  const [byBrand, setByBrand] = useState<any[]>([]);
  const [byCat, setByCat] = useState<any[]>([]);
  const [byCoupon, setByCoupon] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    (async()=>{
      const [b,c,cp] = await Promise.all([
        api.get("/api/catalog/brands/"),
        api.get("/api/catalog/categories/"),
        api.get("/api/admin/coupons/")
      ]);
      setBrands(b.data); setCategories(c.data); setCoupons(cp.data);
    })();
  },[]);

  const query = useMemo(()=>{
    const p = new URLSearchParams();
    p.set("date_from", dateFrom); p.set("date_to", dateTo); p.set("group", group);
    if (selBrands.length) p.set("brands", selBrands.join(","));
    if (selCats.length) p.set("categories", selCats.join(","));
    if (selCoupons.length) p.set("coupons", selCoupons.join(","));
    return p.toString();
  }, [dateFrom, dateTo, group, selBrands, selCats, selCoupons]);

  async function run(){
    setLoading(true);
    const { data } = await api.get(`/api/admin/analytics/sales_summary/?${query}`);
    setSeries(data.series||[]);
    setTotals(data.totals||{revenue:0,items:0,orders:0});
    setByBrand((data.breakdown?.brands)||[]);
    setByCat((data.breakdown?.categories)||[]);
    setByCoupon((data.breakdown?.coupons)||[]);
    setTop((data.top_products)||[]);
    setLoading(false);
  }

  useEffect(()=>{ run(); }, []);

  function toggle<T>(arr:T[], set:(v:T[])=>void, v:T){
    set(arr.includes(v) ? arr.filter(x=>x!==v) : [...arr, v]);
  }

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-8 space-y-6">
      <h1 className="text-xl font-bold">Dashboard</h1>

      <section className="grid md:grid-cols-5 gap-2 p-3 rounded border border-zinc-800 bg-zinc-900">
        <div className="space-y-1">
          <label className="text-xs text-zinc-400">From</label>
          <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-zinc-400">To</label>
          <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-zinc-400">Group by</label>
          <select value={group} onChange={e=>setGroup(e.target.value as any)} className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1">
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
            <option value="quarter">Quarter</option>
          </select>
        </div>
        <button onClick={run} className="self-end px-3 py-2 rounded bg-zinc-800 hover:bg-zinc-700">Run</button>

        <div className="flex items-end gap-2 justify-end">
          <a className="px-3 py-2 rounded bg-zinc-800 hover:bg-zinc-700" href={`/api/admin/analytics/export.csv?${query}`} target="_blank" rel="noreferrer">Export CSV</a>
          <a className="px-3 py-2 rounded bg-zinc-800 hover:bg-zinc-700" href={`/api/admin/analytics/export.xlsx?${query}`} target="_blank" rel="noreferrer">Export Excel</a>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-3">
        <div className="p-3 rounded border border-zinc-800 bg-zinc-900">
          <div className="text-xs text-zinc-400">Revenue</div>
          <div className="text-2xl font-bold">฿{(totals.revenue||0).toLocaleString()}</div>
        </div>
        <div className="p-3 rounded border border-zinc-800 bg-zinc-900">
          <div className="text-xs text-zinc-400">Orders</div>
          <div className="text-2xl font-bold">{totals.orders||0}</div>
        </div>
        <div className="p-3 rounded border border-zinc-800 bg-zinc-900">
          <div className="text-xs text-zinc-400">Items</div>
          <div className="text-2xl font-bold">{totals.items||0}</div>
        </div>
      </section>

      <section className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-3 rounded border border-zinc-800 bg-zinc-900">
          <h2 className="font-semibold mb-2">Revenue over time</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.6}/>
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="revenue" stroke="#22d3ee" fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-3 rounded border border-zinc-800 bg-zinc-900">
          <h2 className="font-semibold mb-2">Top products</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="product__name_en" hide />
                <YAxis />
                <Tooltip />
                <Bar dataKey="revenue" fill="#22d3ee" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="grid lg:grid-cols-3 gap-6">
        <div className="p-3 rounded border border-zinc-800 bg-zinc-900">
          <h3 className="font-semibold mb-2">Filter: Brands</h3>
          <div className="grid grid-cols-2 gap-1 text-sm">
            {brands.map(b => (
              <label key={b.id} className="inline-flex items-center gap-2">
                <input type="checkbox" checked={selBrands.includes(b.id)} onChange={()=>toggle(selBrands,setSelBrands,b.id)} />
                <span>{b.name}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="p-3 rounded border border-zinc-800 bg-zinc-900">
          <h3 className="font-semibold mb-2">Filter: Categories</h3>
          <div className="grid grid-cols-2 gap-1 text-sm">
            {categories.map(b => (
              <label key={b.id} className="inline-flex items-center gap-2">
                <input type="checkbox" checked={selCats.includes(b.id)} onChange={()=>toggle(selCats,setSelCats,b.id)} />
                <span>{b.name}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="p-3 rounded border border-zinc-800 bg-zinc-900">
          <h3 className="font-semibold mb-2">Filter: Coupons</h3>
          <div className="grid grid-cols-2 gap-1 text-sm">
            {coupons.map(c => (
              <label key={c.id} className="inline-flex items-center gap-2">
                <input type="checkbox" checked={selCoupons.includes(c.code)} onChange={()=>toggle(selCoupons,setSelCoupons,c.code)} />
                <span>{c.code}</span>
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="grid lg:grid-cols-3 gap-6">
        <div className="p-3 rounded border border-zinc-800 bg-zinc-900">
          <h2 className="font-semibold mb-2">By Brand</h2>
          <table className="w-full text-sm">
            <thead className="text-zinc-400">
              <tr><th className="text-left">Brand</th><th className="text-right">Revenue</th><th className="text-right">Items</th></tr>
            </thead>
            <tbody>
              {byBrand.map((b,i)=>(
                <tr key={i}><td>{b["product__brand__name"]||"—"}</td><td className="text-right">฿{(b.revenue||0).toLocaleString()}</td><td className="text-right">{b.items||0}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-3 rounded border border-zinc-800 bg-zinc-900">
          <h2 className="font-semibold mb-2">By Category</h2>
          <table className="w-full text-sm">
            <thead className="text-zinc-400">
              <tr><th className="text-left">Category</th><th className="text-right">Revenue</th><th className="text-right">Items</th></tr>
            </thead>
            <tbody>
              {byCat.map((b,i)=>(
                <tr key={i}><td>{b["product__category__name"]||"—"}</td><td className="text-right">฿{(b.revenue||0).toLocaleString()}</td><td className="text-right">{b.items||0}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-3 rounded border border-zinc-800 bg-zinc-900">
          <h2 className="font-semibold mb-2">By Coupon</h2>
          <table className="w-full text-sm">
            <thead className="text-zinc-400">
              <tr><th className="text-left">Coupon</th><th className="text-right">Revenue</th><th className="text-right">Items</th></tr>
            </thead>
            <tbody>
              {byCoupon.map((b,i)=>(
                <tr key={i}><td>{b["order__coupon__code"]||"—"}</td><td className="text-right">฿{(b.revenue||0).toLocaleString()}</td><td className="text-right">{b.items||0}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex justify-end">
        <a className="px-3 py-2 rounded bg-zinc-800 hover:bg-zinc-700" href={`/api/admin/analytics/export_stock.csv`} target="_blank" rel="noreferrer">Export Stock CSV</a>
      </section>
    </main>
  );
}
