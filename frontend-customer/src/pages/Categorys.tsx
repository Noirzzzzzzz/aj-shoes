import { useEffect, useState } from "react";
import api from "@/api/client";
import ProductRow from "@/components/ProductRow";
import { RowSkeleton } from "@/components/Skeleton";

type Product = any;
type Row = { title: string; products: Product[] };
const LIMIT = 12;

export default function Categorys() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    console.log("[Categorys] mounted, path =", window.location.pathname);
    let alive = true;

    (async () => {
      setLoading(true);
      setErr(null);

      // 1) ใช้ endpoint รวมแถวจาก backend ก่อน (กัน cache ด้วย ts)
      try {
        const r = await api.get("/api/catalog/categories/rows/", {
          params: { limit: LIMIT, ts: Date.now() },
        });
        const data = r.data;
        const normalized: Row[] = Array.isArray(data?.rows)
          ? data.rows
          : Object.entries(data || {}).map(([title, products]) => ({
              title,
              products: products as Product[],
            }));
        if (alive) setRows(normalized);
      } catch (e: any) {
        console.warn("[Categorys] /categories/rows/ failed -> fallback. msg:", e?.message);

        // 2) Fallback: ดึงรายชื่อหมวด แล้วคิวรีสินค้าตามหมวด
        try {
          const cr = await api.get("/api/catalog/categories/", { params: { page_size: 100, ts: Date.now() } });
          const catList = cr.data?.results ?? cr.data ?? [];
          const list: Row[] = [];

          for (const c of catList) {
            let items: Product[] = [];
            // ถ้ามี filter ?category=<name> จะใช้เส้นนี้ (แม่นสุด)
            try {
              const pr = await api.get("/api/catalog/products/", {
                params: { category: c.name, ordering: "-popularity", ts: Date.now() },
              });
              items = pr.data?.results ?? pr.data ?? [];
            } catch {
              // ถ้ายังไม่มี filter category -> ใช้ search ชั่วคราว
              const pr = await api.get("/api/catalog/products/", {
                params: { search: c.name, ordering: "-popularity", ts: Date.now() },
              });
              items = pr.data?.results ?? pr.data ?? [];
            }

            list.push({ title: c.name, products: items.slice(0, LIMIT) });
          }

          if (alive) setRows(list);
        } catch (e2: any) {
          if (alive) setErr(e2?.message ?? "Failed to load");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-6 space-y-8">
        <h1 className="text-lg font-semibold mb-2">หมวดหมู่ (Categorys)</h1>
        <RowSkeleton /><RowSkeleton /><RowSkeleton />
      </main>
    );
  }

  if (err) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-6">
        <h1 className="text-lg font-semibold mb-2">หมวดหมู่ (Categorys)</h1>
        <p className="text-sm text-red-400">Error: {err}</p>
      </main>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-6">
        <h1 className="text-lg font-semibold mb-2">หมวดหมู่ (Categorys)</h1>
        <p className="text-sm opacity-70">No category rows.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 space-y-8">
      <h1 className="sr-only">หมวดหมู่ (Categorys)</h1>
      {rows.map((row) => (
        <ProductRow key={row.title} title={row.title} products={row.products} />
      ))}
    </main>
  );
}
