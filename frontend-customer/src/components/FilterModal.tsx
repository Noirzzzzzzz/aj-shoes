import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";

export type SortKey =
  | "-popularity"
  | "popularity"
  | "base_price"
  | "-base_price"
  | "-sale_percent"
  | "sale_percent";

export type FilterState = {
  brand: string | "";
  minPrice: number | "";
  maxPrice: number | "";
  sortBy: SortKey;
  discountOnly: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onApply: (f: FilterState) => void;
  initial?: FilterState;
  brands?: Array<{ id: number; name: string }>;
};

const defaultFilter: FilterState = {
  brand: "",
  minPrice: "",
  maxPrice: "",
  sortBy: "-popularity",
  discountOnly: false,
};

function ModalContent({
  open,
  onClose,
  onApply,
  initial,
  brands = [],
}: Props) {
  const { t } = useTranslation();
  const [state, setState] = useState<FilterState>(initial ?? defaultFilter);

  // sync ค่าเริ่มต้นทุกครั้งที่เปิด
  useEffect(() => {
    if (open) setState(initial ?? defaultFilter);
  }, [open, initial]);

  // ปิดด้วย ESC + ล็อค body scroll ตอนเปิด
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) {
      document.addEventListener("keydown", key);
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", key);
        document.body.style.overflow = prev;
      };
    }
  }, [open, onClose]);

  const sortOptions: Array<{ value: FilterState["sortBy"]; label: string }> = useMemo(
    () => [
      { value: "-popularity", label: `${t("popularity")} ↓` },
      { value: "popularity", label: `${t("popularity")} ↑` },
      { value: "base_price", label: `${t("price")} ↑` },
      { value: "-base_price", label: `${t("price")} ↓` },
      { value: "-sale_percent", label: `${t("discount")} ↓` },
      { value: "sale_percent", label: `${t("discount")} ↑` },
    ],
    [t]
  );

  return (
    <AnimatePresence>
      {open && (
        // Backdrop: ครอบเต็มจอ + เบลอทั้งหน้า + ซ้อนเหนือ navbar (z-100)
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[100] bg-black/45 backdrop-blur-md"
          onClick={onClose}
        >
          {/* กล่องโมดัล: จัดกลางจอ, ไม่ติดขอบ, สูงไม่ล้น */}
          <motion.div
            key="panel"
            initial={{ y: -12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -12, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="fixed inset-x-0 top-20 mx-auto w-[min(92vw,700px)] max-h-[calc(100vh-10rem)] overflow-y-auto rounded-2xl bg-zinc-900 text-zinc-100 shadow-2xl border border-white/10"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 sticky top-0 bg-zinc-900/95 backdrop-blur rounded-t-2xl border-b border-white/10">
              <h3 className="text-lg font-semibold">{t("filters") || "Filters"}</h3>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10">
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-4">
              {/* Brand */}
              <div className="space-y-2">
                <label className="text-sm opacity-80">{t("brand") || "Brand"}</label>
                <select
                  className="w-full rounded-xl bg-zinc-800 border border-white/10 px-3 py-2 outline-none"
                  value={state.brand}
                  onChange={(e) => setState((s) => ({ ...s, brand: e.target.value }))}
                >
                  <option value="">{t("all") || "All"}</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Price */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm opacity-80">{t("minPrice") || "Min Price (฿)"}</label>
                  <input
                    type="number"
                    min={0}
                    className="w-full rounded-xl bg-zinc-800 border border-white/10 px-3 py-2 outline-none"
                    value={state.minPrice}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        minPrice: e.target.value === "" ? "" : Number(e.target.value),
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm opacity-80">{t("maxPrice") || "Max Price (฿)"}</label>
                  <input
                    type="number"
                    min={0}
                    className="w-full rounded-xl bg-zinc-800 border border-white/10 px-3 py-2 outline-none"
                    value={state.maxPrice}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        maxPrice: e.target.value === "" ? "" : Number(e.target.value),
                      }))
                    }
                  />
                </div>
              </div>

              {/* Sort */}
              <div className="space-y-2">
                <label className="text-sm opacity-80">{t("sortBy") || "Sort By"}</label>
                <select
                  className="w-full rounded-xl bg-zinc-800 border border-white/10 px-3 py-2 outline-none"
                  value={state.sortBy}
                  onChange={(e) =>
                    setState((s) => ({ ...s, sortBy: e.target.value as FilterState["sortBy"] }))
                  }
                >
                  {sortOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Discount only */}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={state.discountOnly}
                  onChange={(e) => setState((s) => ({ ...s, discountOnly: e.target.checked }))}
                />
                {t("discountOnly") || "Show only discounted products"}
              </label>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-4 border-t border-white/10 rounded-b-2xl sticky bottom-0 bg-zinc-900/95 backdrop-blur">
              <button
                className="px-3 py-2 rounded-xl bg-transparent border border-white/15 hover:bg-white/5"
                onClick={() => setState(defaultFilter)}
              >
                {t("clearAll") || "Clear All"}
              </button>
              <div className="flex gap-2">
                <button
                  className="px-3 py-2 rounded-xl bg-transparent border border-white/15 hover:bg-white/5"
                  onClick={onClose}
                >
                  {t("cancel") || "Cancel"}
                </button>
                <button
                  className="px-4 py-2 rounded-xl bg-white text-black font-medium hover:opacity-90"
                  onClick={() => onApply(state)}
                >
                  {t("applyFilters") || "Apply Filters"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function FilterModal(props: Props) {
  // ใช้ Portal วาดโมดัลบน document.body เพื่อกันปัญหา fixed/overflow/transform จาก parent
  return createPortal(<ModalContent {...props} />, document.body);
}
