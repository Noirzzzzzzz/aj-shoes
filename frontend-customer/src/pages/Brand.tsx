import { useEffect, useState } from "react";
import api from "@/api/client";
import ProductRow from "@/components/ProductRow";
import { RowSkeleton } from "@/components/Skeleton";

type Product = any;
type Row = { title: string; products: Product[] };
const LIMIT = 12;

export default function Brand() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErr(null);

      // 1) ใช้ endpoint ใหม่ (แนะนำ)
      try {
        const r = await api.get("/api/catalog/brands/rows/", { params: { limit: LIMIT } });
        const data = r.data;
        const normalized: Row[] = Array.isArray(data?.rows)
          ? data.rows
          : Object.entries(data || {}).map(([title, products]) => ({
              title,
              products: products as Product[],
            }));
        if (alive) setRows(normalized);
      } catch (e: any) {
        // 2) Fallback: ประกอบแถวฝั่ง client จากรายชื่อแบรนด์
        try {
          const br = await api.get("/api/catalog/brands/");
          const brandList = br.data?.results ?? br.data ?? [];
          const list: Row[] = [];

          for (const b of brandList) {
            const pr = await api.get("/api/catalog/products/", {
              // ถ้า ProductFilter รองรับ brand อยู่แล้ว ใช้ iexact ชื่อแบรนด์ได้เลย
              params: { brand: b.name, ordering: "-popularity" },
            });
            const items: Product[] = pr.data?.results ?? pr.data ?? [];
            list.push({ title: b.name, products: items.slice(0, LIMIT) });
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
        <RowSkeleton /><RowSkeleton /><RowSkeleton />
      </main>
    );
  }

  if (err) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-6">
        <p className="text-sm text-red-400">Error: {err}</p>
      </main>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-6">
        <p className="text-sm opacity-70">No brand rows.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 space-y-8">
      {rows.map((row) => (
        <ProductRow key={row.title} title={row.title} products={row.products} />
      ))}
    </main>
  );
}
