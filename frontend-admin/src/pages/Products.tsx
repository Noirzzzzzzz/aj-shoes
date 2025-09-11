import { useEffect, useState } from "react";
import api from "@/api";
import toast from "react-hot-toast";

type Product = {
  id:number;
  name_en:string; name_th:string;
  base_price:number|string;
  sale_percent:number;
  brand:number; category:number|null;
  is_active:boolean;
  images:{id:number; image_url:string; is_cover:boolean; sort_order:number}[];
  variants:{id:number; color:string; size_eu:string; size_cm:string; stock:number}[];
};

export default function Products(){
  const [list,setList] = useState<Product[]>([]);
  const [sel,setSel] = useState<Product|null>(null);
  const [loading,setLoading] = useState(true);

  async function load(){
    setLoading(true);
    const { data } = await api.get("/api/catalog/products/", { params: { ordering:"-id" } });
    setList(data.results || data);
    setLoading(false);
  }
  useEffect(()=>{ load(); }, []);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Products</h1>
        <button onClick={()=>setSel({id:0,name_en:"",name_th:"",base_price:0,sale_percent:0,brand:0,category:null,is_active:true,images:[],variants:[]})}
          className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500">New Product</button>
      </div>

      <div className="grid gap-3">
        {list.map(p => (
          <div key={p.id} className="p-3 rounded border border-zinc-800 bg-zinc-900">
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 bg-zinc-800 rounded overflow-hidden">
                {p.images[0] && <img src={p.images.find(i=>i.is_cover)?.image_url||p.images[0].image_url} className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1">
                <div className="font-semibold">{p.name_en}</div>
                <div className="text-xs text-zinc-400">ID {p.id} • ฿{p.base_price} • sale {p.sale_percent}%</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={()=>setSel(p)} className="px-2 py-1 text-xs rounded bg-zinc-800 hover:bg-zinc-700">Edit</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {sel && <Editor product={sel} onClose={()=>{ setSel(null); load(); }} />}
    </main>
  );
}

function Editor({ product, onClose }:{ product: Product; onClose: () => void }){
  const isNew = product.id===0;
  const [p, setP] = useState<Product>(product);

  async function save(){
    if (isNew){
      const { data } = await api.post("/api/admin/catalog/products/", p);
      setP(data);
      toast.success("Created");
    } else {
      const { data } = await api.put(`/api/admin/catalog/products/${p.id}/`, p);
      setP(data);
      toast.success("Saved");
    }
  }
  async function del(){
    if (!p.id) return;
    await api.delete(`/api/admin/catalog/products/${p.id}/`);
    toast.success("Deleted");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative z-10 mx-auto my-10 max-w-5xl bg-zinc-950 border border-zinc-800 rounded-2xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{isNew ? "New Product" : `Edit #${p.id}`}</h2>
          <div className="flex items-center gap-2">
            {!isNew && <button onClick={del} className="px-3 py-1 rounded bg-red-600 hover:bg-red-500">Delete</button>}
            <button onClick={save} className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500">Save</button>
            <button onClick={onClose} className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700">Close</button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <input className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1" placeholder="Name EN" value={p.name_en} onChange={e=>setP({...p, name_en:e.target.value})} />
            <input className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1" placeholder="Name TH" value={p.name_th} onChange={e=>setP({...p, name_th:e.target.value})} />
            <textarea className="w-full h-20 bg-zinc-900 border border-zinc-700 rounded px-2 py-1" placeholder="Desc EN" onChange={e=>setP({...p, description_en:e.target.value})} />
            <textarea className="w-full h-20 bg-zinc-900 border border-zinc-700 rounded px-2 py-1" placeholder="Desc TH" onChange={e=>setP({...p, description_th:e.target.value})} />
          </div>
          <div className="space-y-2">
            <input type="number" className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1" placeholder="Base price" value={p.base_price as any} onChange={e=>setP({...p, base_price:Number(e.target.value)})} />
            <input type="number" className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1" placeholder="Sale % (superadmin only)" value={p.sale_percent} onChange={e=>setP({...p, sale_percent:Number(e.target.value)})} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.is_active} onChange={e=>setP({...p, is_active:e.target.checked})} /> Active</label>
          </div>
        </div>

        <Images product={p} setProduct={setP} />
        <Variants product={p} />
      </div>
    </div>
  );
}

function Images({ product, setProduct }:{ product: Product; setProduct: (p:Product)=>void }){
  const [url, setUrl] = useState("");
  async function addByUrl(){
    const { data } = await api.post("/api/admin/catalog/images/add_by_url/", { product: product.id, image_url: url });
    setProduct({ ...product, images: [...product.images, data] });
    setUrl("");
  }
  async function setCover(id:number){
    await api.post(`/api/admin/catalog/images/${id}/set_cover/`);
    setProduct({ ...product, images: product.images.map(im => ({...im, is_cover: im.id===id})) });
  }
  async function delImage(id:number){
    await api.delete(`/api/admin/catalog/images/${id}/`);
    setProduct({ ...product, images: product.images.filter(im => im.id!==id) });
  }
  async function move(id:number, dir:-1|1){
    const imgs = [...product.images].sort((a,b)=>a.sort_order-b.sort_order);
    const idx = imgs.findIndex(i=>i.id===id);
    if (idx<0) return;
    const j = idx + dir;
    if (j<0 || j>=imgs.length) return;
    [imgs[idx].sort_order, imgs[j].sort_order] = [imgs[j].sort_order, imgs[idx].sort_order];
    await api.post("/api/admin/catalog/images/reorder/", { orders: imgs.map(i=>({id:i.id, sort_order:i.sort_order})) });
    setProduct({ ...product, images: imgs });
  }
  return (
    <section className="space-y-2">
      <h3 className="font-semibold">Images</h3>
      <div className="flex gap-2">
        <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="Image URL" className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1" />
        <button onClick={addByUrl} className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700">Add by URL</button>
      </div>
      <div className="flex gap-3 overflow-x-auto">
        {product.images.sort((a,b)=>a.sort_order-b.sort_order).map(im => (
          <div key={im.id} className="w-36">
            <div className="w-36 h-36 bg-zinc-800 rounded overflow-hidden">
              <img src={im.image_url} className="w-full h-full object-cover" />
            </div>
            <div className="flex items-center gap-1 mt-1">
              <button onClick={()=>move(im.id,-1)} className="text-xs px-2 py-1 rounded bg-zinc-800">↑</button>
              <button onClick={()=>move(im.id,1)} className="text-xs px-2 py-1 rounded bg-zinc-800">↓</button>
              <button onClick={()=>setCover(im.id)} className={`text-xs px-2 py-1 rounded ${im.is_cover?"bg-emerald-600":"bg-zinc-800"}`}>Cover</button>
              <button onClick={()=>delImage(im.id)} className="text-xs px-2 py-1 rounded bg-red-600">Del</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Variants({ product }:{ product: Product }){
  const [list, setList] = useState(product.variants);
  const [form, setForm] = useState({ color:"", size_eu:"", size_cm:"", stock:0 });

  useEffect(()=>{ setList(product.variants); }, [product.id]);

  async function add(){
    const { data } = await api.post("/api/admin/catalog/variants/", { product: product.id, ...form });
    setList([...list, data]);
    setForm({ color:"", size_eu:"", size_cm:"", stock:0 });
  }
  async function save(v:any){
    const { data } = await api.put(`/api/admin/catalog/variants/${v.id}/`, v);
    setList(list.map(it=>it.id===v.id?data:it));
  }
  async function del(id:number){
    await api.delete(`/api/admin/catalog/variants/${id}/`);
    setList(list.filter(v=>v.id!==id));
  }

  return (
    <section className="space-y-2">
      <h3 className="font-semibold">Variants</h3>
      <div className="grid md:grid-cols-5 gap-2">
        <input placeholder="Color" value={form.color} onChange={e=>setForm({...form,color:e.target.value})} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1" />
        <input placeholder="EU" value={form.size_eu} onChange={e=>setForm({...form,size_eu:e.target.value})} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1" />
        <input placeholder="CM" value={form.size_cm} onChange={e=>setForm({...form,size_cm:e.target.value})} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1" />
        <input type="number" placeholder="Stock" value={form.stock} onChange={e=>setForm({...form,stock:Number(e.target.value)})} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1" />
        <button onClick={add} className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700">Add</button>
      </div>

      <div className="grid gap-2">
        {list.map(v => (
          <div key={v.id} className="grid md:grid-cols-6 gap-2 p-2 rounded border border-zinc-800 bg-zinc-900">
            <input value={v.color} onChange={e=>save({...v, color:e.target.value})} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1" />
            <input value={v.size_eu} onChange={e=>save({...v, size_eu:e.target.value})} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1" />
            <input value={v.size_cm} onChange={e=>save({...v, size_cm:e.target.value})} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1" />
            <input type="number" value={v.stock} onChange={e=>save({...v, stock:Number(e.target.value)})} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1" />
            <div className="md:col-span-2 flex items-center">
              <button onClick={()=>del(v.id)} className="px-3 py-1 rounded bg-red-600 hover:bg-red-500">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
