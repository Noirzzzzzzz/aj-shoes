// SearchControl.tsx  (ready-to-replace)
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, createSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Search, SlidersHorizontal } from "lucide-react";
import api from "@/api/client";
import FilterModal, { FilterState } from "./FilterModal";

type Brand = { id: number; name: string };
type Suggestion = { id?: number; label: string; value: string };

export default function SearchControl() {
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

  // suggestions
  const [sugs, setSugs] = useState<Suggestion[]>([]);
  const [openSugs, setOpenSugs] = useState(false);
  const [active, setActive] = useState(-1);
  const debounceRef = useRef<number | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/api/catalog/brands/").then((r) => setBrands(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (expanded) setTimeout(() => inputRef.current?.focus(), 60);
    else {
      setOpenSugs(false);
      setActive(-1);
    }
  }, [expanded]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setExpanded(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const buildParams = (q: string, f: FilterState) => {
    const params: Record<string, string> = {};
    if (q.trim()) params.search = q.trim();
    if (f.brand) params.brand = f.brand;
    if (f.sortBy) params.ordering = f.sortBy;
    if (f.minPrice !== "") params.min_price = String(f.minPrice);
    if (f.maxPrice !== "") params.max_price = String(f.maxPrice);
    if (f.discountOnly) params.discount_only = "1";
    return params;
  };

  const goSearch = (q: string, f: FilterState) => {
    navigate({ pathname: "/search", search: createSearchParams(buildParams(q, f)).toString() });
    setExpanded(false);
    setOpenSugs(false);
  };

  // === Autocomplete (debounced) ===
  useEffect(() => {
    if (!expanded) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      const q = query.trim();
      if (!q) {
        setSugs([]);
        setOpenSugs(false);
        setActive(-1);
        return;
      }
      try {
        // 1) try dedicated suggest endpoint
        const url1 = "/api/catalog/suggest/";
        let data: any;
        try {
          const r = await api.get(url1, { params: { q, limit: 8 } });
          data = r.data;
        } catch {
          // 2) fallback: search products and map to suggestions
          const r2 = await api.get("/api/catalog/products/", {
            params: { search: q, page_size: 8, ordering: "-popularity" },
          });
          const arr = (r2.data?.results ?? r2.data ?? []).slice(0, 8);
          data = arr.map((p: any) => ({
            label: p.name || p.title || `${p.brand?.name ?? ""} ${p.model ?? ""}`.trim(),
            value: (p.name || p.title || "").toString(),
          }));
        }
        // normalize to Suggestion[]
        const mapped: Suggestion[] = Array.isArray(data)
          ? data.map((x: any) => ({
              id: x.id,
              label: (x.label ?? x.name ?? x.title ?? x.value ?? "").toString(),
              value: (x.value ?? x.name ?? x.title ?? "").toString(),
            }))
          : [];
        // unique top 8 + add raw query as first item
        const uniq = [
          { label: `“${q}”`, value: q },
          ...mapped.filter((m) => m.value && m.value.toLowerCase() !== q.toLowerCase()),
        ].slice(0, 8);
        setSugs(uniq);
        setOpenSugs(true);
        setActive(-1);
      } catch {
        setSugs([]);
        setOpenSugs(false);
        setActive(-1);
      }
    }, 200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, expanded]);

  // keyboard nav inside suggestions
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!openSugs || sugs.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % sugs.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + sugs.length) % sugs.length);
    } else if (e.key === "Enter") {
      if (active >= 0 && active < sugs.length) {
        e.preventDefault();
        const s = sugs[active];
        setQuery(s.value);
        goSearch(s.value, filters);
      }
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    goSearch(query, filters);
  };

  const SuggestList = (
    <AnimatePresence>
      {openSugs && sugs.length > 0 && (
        <motion.div
          ref={listRef}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.12 }}
          className="absolute left-0 right-0 top-[42px] z-[70] rounded-xl overflow-hidden border border-white/10 bg-zinc-900 shadow-2xl"
        >
          {sugs.map((s, idx) => (
            <button
              key={`${s.value}-${idx}`}
              type="button"
              onMouseDown={(ev) => ev.preventDefault()}
              onClick={() => {
                setQuery(s.value);
                goSearch(s.value, filters);
              }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-white/10 ${
                idx === active ? "bg-white/10" : ""
              }`}
            >
              {s.label}
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <div className="flex items-center gap-2 h-14 relative">
        <button
          aria-label="Search"
          title={"Search"}
          onClick={() => setExpanded((s) => !s)}
          className="h-9 w-9 grid place-items-center rounded-xl hover:bg-white/10 shrink-0"
        >
          <Search size={18} />
        </button>

        {/* Desktop search bar with suggestions */}
        <AnimatePresence>
          {expanded && (
            <motion.form
              onSubmit={onSubmit}
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "clamp(280px, 40vw, 520px)" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              className="hidden md:flex items-center h-10 overflow-visible rounded-2xl bg-zinc-900 border border-white/10 shadow-lg relative"
            >
              <div className="px-2 h-full grid place-items-center">
                <Search size={16} className="opacity-70" />
              </div>

              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                onFocus={() => query && setOpenSugs(true)}
                onBlur={() => setTimeout(() => setOpenSugs(false), 120)}
                placeholder={"Search"}
                className="bg-transparent outline-none px-2 text-sm flex-1 h-full"
              />
              {SuggestList}

              <button
                type="button"
                aria-label="Filters"
                title={"Filters"}
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
                <span className="hidden lg:inline">{"Search"}</span>
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Mobile overlay (suggestions appear right under input) */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              className="md:hidden fixed left-0 right-0 top-0 z-[55] px-3 py-2 bg-zinc-950/95 backdrop-blur border-b border-white/10"
              initial={{ y: -60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -60, opacity: 0 }}
            >
              <form onSubmit={onSubmit} className="flex items-center gap-2 relative">
                <div className="px-2 h-10 rounded-2xl bg-zinc-900 border border-white/10 flex-1 flex items-center relative">
                  <Search size={16} className="opacity-70" />
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={onKeyDown}
                    onFocus={() => query && setOpenSugs(true)}
                    onBlur={() => setTimeout(() => setOpenSugs(false), 120)}
                    placeholder={"Search"}
                    className="bg-transparent outline-none px-2 w-full text-sm h-full"
                  />
                  {/* suggestions list for mobile */}
                  <div className="absolute left-0 right-0 top-[42px]">{SuggestList}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setFilterOpen(true)}
                  className="h-9 w-9 grid place-items-center rounded-xl hover:bg-white/10"
                >
                  <SlidersHorizontal size={18} />
                </button>
                <button type="submit" className="h-9 px-3 rounded-xl bg-white text-black text-sm">
                  {"Go"}
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
