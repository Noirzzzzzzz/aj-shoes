import { useEffect, useState } from "react";
import { Product } from "@/types";
import ProductCard from "./ProductCard";
import ProductModal from "./ProductModal";
import api from "@/api/client";
import { RowSkeleton } from "./Skeleton";
export default function ProductRow({ title, products }: { title: string; products?: Product[] }) {
  const [list, setList] = useState<Product[]>(products || []);
  const [loading, setLoading] = useState(!products);
  const [sel, setSel] = useState<Product | null>(null);

  useEffect(() => {
    if (products) return;
    setLoading(true);
    api.get("/api/catalog/products/", { params: { ordering: "-popularity" } })
      .then(r => setList(r.data.results || r.data))
      .finally(()=>setLoading(false));
  }, [products]);

  return (
    <section className="space-y-2">
      <h2 className="px-1 text-sm font-semibold">{title}</h2>
      {loading ? <RowSkeleton /> : (
        <div className="flex gap-3 overflow-x-auto scrollx-hide">
          {list.map(p => (
            <ProductCard key={p.id} p={p} onClick={() => setSel(p)} />
          ))}
        </div>
      )}
      {sel && <ProductModal p={sel} onClose={() => setSel(null)} />}
    </section>
  );
}
