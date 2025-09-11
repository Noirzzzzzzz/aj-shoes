// Wishlist.tsx (ใช้ต่อได้ แต่รีแบรนด์ endpoint + title แล้ว)
import { useEffect, useState } from "react";
import Protected from "@/components/Protected";
import api from "@/api/client";
import { Product } from "@/types";
import ProductCard from "@/components/ProductCard";
import ProductModal from "@/components/ProductModal";

type Wish = { id:number; product:number };
export default function Wishlist() { return <Protected><WishlistInner /></Protected>; }

function WishlistInner() {
  const [list, setList] = useState<Product[]>([]);
  const [sel, setSel] = useState<Product | null>(null);

  async function load() {
    try {
      // ✅ เดิมเรียก /api/orders/wishlist/ → เปลี่ยนเป็น /favorites/
      const { data: wishes } = await api.get("/api/orders/favorites/");
      const ids = Array.from(new Set((wishes as Wish[]).map(w => w.product)));
      if (ids.length === 0) { setList([]); return; }

      const { data: products } = await api.get("/api/catalog/products/", {
        params: { ids: ids.join(",") },
      });
      const items = Array.isArray(products?.results) ? products.results : products;
      setList(items || []);
    } catch {
      setList([]);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 space-y-4">
      {/* ✅ เปลี่ยนชื่อหัวข้อ */}
      <h1 className="text-xl font-bold">Favorites</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {list.map(p => <ProductCard key={p.id} p={p} onClick={() => setSel(p)} />)}
      </div>
      {sel && <ProductModal p={sel} onClose={() => setSel(null)} />}
    </main>
  );
}
