import React, { useEffect, useRef, useState } from "react";
import { useNavigate, createSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Search, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import api from "@/api/client";
import FilterModal, { FilterState } from "./FilterModal";

type Brand = { id: number; name: string };

export default function SearchControl() {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>({
    brand: "",
    minPrice: "",
    maxPrice: "",
    sortBy: "-popularity",
    discountOnly: false,
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/api/catalog/brands/").then((r) => setBrands(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (expanded) setTimeout(() => inputRef.current?.focus(), 60);
  }, [expanded]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setExpanded(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const goSearch = (q: string, f: FilterState) => {
    const params: Record<string, string> = {};
    if (q.trim()) params.search = q.trim();
    if (f.brand) params.brand = f.brand;
    if (f.sortBy) params.ordering = f.sortBy;
    if (f.minPrice !== "") params.min_price = String(f.minPrice);
    if (f.maxPrice !== "") params.max_price = String(f.maxPrice);
    if (f.discountOnly) params.discount_only = "1";

    navigate({ pathname: "/search", search: createSearchParams(params).toString() });
    setExpanded(false);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    goSearch(query, filters);
  };

  return (
    <>
      <div className="flex items-center gap-2 h-14">
        {/* ปุ่มไอคอน (ความสูงคงที่) */}
        <button
          aria-label="Search"
          title={t("search") || "Search"}
          onClick={() => setExpanded((s) => !s)}
          className="h-9 w-9 grid place-items-center rounded-xl hover:bg-white/10 shrink-0"
        >
          <Search size={18} />
        </button>

        {/* Desktop: แถบขยาย */}
        <AnimatePresence>
          {expanded && (
            <motion.form
              onSubmit={onSubmit}
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "clamp(280px, 40vw, 520px)" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              className="hidden md:flex items-center h-10 overflow-hidden rounded-2xl bg-zinc-900 border border-white/10 shadow-lg"
            >
              <div className="px-2 h-full grid place-items-center">
                <Search size={16} className="opacity-70" />
              </div>

              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("search") || "Search"}
                className="bg-transparent outline-none px-2 text-sm flex-1 h-full"
              />

              <button
                type="button"
                aria-label="Filters"
                title={t("filters") || "Filters"}
                onClick={() => setFilterOpen(true)}
                className="h-9 w-9 grid place-items-center rounded-xl hover:bg-white/10 shrink-0 mr-1"
              >
                <SlidersHorizontal size={18} />
              </button>

              <button
                type="submit"
                className="h-9 px-3 rounded-xl bg-white text-black hover:opacity-90 shrink-0 mr-2 flex items-center gap-1 text-sm"
              >
                <Search size={14} />
                <span className="hidden lg:inline">{t("search") || "Search"}</span>
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Mobile: overlay */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              className="md:hidden fixed left-0 right-0 top-0 z-[55] px-3 py-2 bg-zinc-950/95 backdrop-blur border-b border-white/10"
              initial={{ y: -60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -60, opacity: 0 }}
            >
              <form onSubmit={onSubmit} className="flex items-center gap-2">
                <div className="px-2 h-10 rounded-2xl bg-zinc-900 border border-white/10 flex-1 flex items-center">
                  <Search size={16} className="opacity-70" />
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("search") || "Search"}
                    className="bg-transparent outline-none px-2 w-full text-sm h-full"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setFilterOpen(true)}
                  className="h-9 w-9 grid place-items-center rounded-xl hover:bg-white/10"
                >
                  <SlidersHorizontal size={18} />
                </button>
                <button type="submit" className="h-9 px-3 rounded-xl bg-white text-black text-sm">
                  {t("search") || "Go"}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modal ฟิลเตอร์ */}
      <FilterModal
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        brands={brands}
        initial={filters}
        onApply={(f) => {
          setFilters(f);
          setFilterOpen(false);
          goSearch(query, f);
        }}
      />
    </>
  );
}
