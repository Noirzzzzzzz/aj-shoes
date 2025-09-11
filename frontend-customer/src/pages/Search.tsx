import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "@/api/client";
import { Product } from "@/types";
import ProductCard from "@/components/ProductCard";
import ProductModal from "@/components/ProductModal";
import { useTranslation } from "react-i18next";

export default function Search() {
  const { t } = useTranslation();
  const { search } = useLocation();

  // แปลง query string -> URLSearchParams
  const params = useMemo(() => new URLSearchParams(search), [search]);

  // states
  const [list, setList] = useState<Product[]>([]);
  const [sel, setSel] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ค่าไว้โชว์บนหัวหน้าเพจ
  const q = params.get("search") || "";
  const brand = params.get("brand") || "";
  const ordering = params.get("ordering") || "-popularity";
  const minPrice = params.get("min_price") || "";
  const maxPrice = params.get("max_price") || "";
  const discountOnly = params.get("discount_only") === "1";

  // ดึงสินค้าทุกครั้งที่พารามิเตอร์ใน URL เปลี่ยน
  useEffect(() => {
    setLoading(true);
    setError(null);
    const qsObject = Object.fromEntries(params.entries());

    api
      .get("/api/catalog/products/", { params: qsObject })
      .then(({ data }) => setList(data.results ?? data))
      .catch((e) => setError(e?.message ?? "Failed to fetch"))
      .finally(() => setLoading(false));
  }, [params]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 space-y-4">
      {/* หัวหน้าเพจ */}
      <div>
        <h1 className="text-2xl font-bold mb-1">
          {t("Search Results") || "ผลการค้นหา (Search Results)"}
        </h1>
        <p className="text-sm text-zinc-400">
          {q ? (
            <>
              {t("showingFor") || "Showing results for"}{" "}
              <span className="font-semibold">“{q}”</span>
              {discountOnly && " (discount only)"}
            </>
          ) : discountOnly ? (
            <>Showing discounted products only</>
          ) : (
            <>All products</>
          )}
          {/* แสดงสรุป filter อื่น ๆ ถ้ามี */}
          <span className="ml-2">
            {brand && <>· {t("brand") || "Brand"}: {brand}</>}
            {minPrice && <> · ≥ ฿{minPrice}</>}
            {maxPrice && <> · ≤ ฿{maxPrice}</>}
            {ordering && <> · sort: {ordering}</>}
          </span>
        </p>
      </div>

      {/* เนื้อหา */}
      {loading && <div>Loading…</div>}
      {!!error && <div className="text-red-400">{error}</div>}

      {!loading && !error && (
        <>
          {list.length === 0 ? (
            <div className="text-zinc-400">{t("noResults") || "ไม่พบสินค้า"}</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {list.map((p) => (
                <ProductCard key={p.id} p={p} onClick={() => setSel(p)} />
              ))}
            </div>
          )}
        </>
      )}

      {/* โมดัลสินค้า */}
      {sel && <ProductModal p={sel} onClose={() => setSel(null)} />}
    </main>
  );
}
