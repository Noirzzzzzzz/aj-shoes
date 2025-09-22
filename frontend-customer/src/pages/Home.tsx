import { useEffect, useState } from "react";
import api from "@/api/client";
import { HomeRows } from "@/types";
import ProductRow from "@/components/ProductRow";
import { RowSkeleton } from "@/components/Skeleton";

export default function Home() {
  const [rows, setRows] = useState<HomeRows | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    api.get("/api/catalog/products/home_rows/")
      .then(r => setRows(r.data))
      .finally(()=>setLoading(false));
  }, []);

  if (loading || !rows) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-6 space-y-8">
        <RowSkeleton /><RowSkeleton /><RowSkeleton />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 space-y-8">
      <ProductRow title={"สินค้าแนะนำ"} products={rows.recommended} />
      <ProductRow title={"สินค้ากำลังมาแรง"} products={rows.trending} />
      <ProductRow title={"เหมาะกับคุณ"} products={rows.personalized} />
    </main>
  );
}
