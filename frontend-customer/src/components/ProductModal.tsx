import { useState, useMemo } from "react";
import { Product, Variant } from "@/types";
import Price from "./Price";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import api from "@/api/client";
import toast, { Toaster } from "react-hot-toast";
import { optImg } from "@/utils/img";

// ตัวช่วยเหมือนในการ์ด
function mediaUrl(path?: string): string | "" {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const base = (import.meta as any).env?.VITE_MEDIA_URL || "/media/";
  return `${String(base).replace(/\/$/, "")}/${String(path).replace(/^\//, "")}`;
}

function heroSrc(p: Product, w = 640, h = 640, q = 85): string {
  const cover = p.images.find((im: any) => im.is_cover) || p.images[0];
  if (!cover) return "";
  const fileSrc = mediaUrl((cover as any).file);
  if (fileSrc) return fileSrc;
  const u = (cover as any).image_url || "";
  return u ? optImg(u, { w, h, fit: "cover", q }) : "";
}

export default function ProductModal({ p, onClose }:{ p: Product; onClose: () => void; }) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [color, setColor] = useState<string>("");
  const [sizeMode, setSizeMode] = useState<"eu"|"cm">("eu");
  const [size, setSize] = useState<string>("");
  const [qty, setQty] = useState<number>(1);

  const name = i18n.language === "th" && p.name_th ? p.name_th : p.name_en;
  const desc = i18n.language === "th" && p.description_th ? p.description_th : p.description_en;

  const colors = useMemo(() => Array.from(new Set(p.variants.map(v => v.color))), [p.variants]);
  const sizes = useMemo(
    () => Array.from(new Set(p.variants
      .filter(v => v.color === color)
      .map(v => sizeMode === "eu" ? v.size_eu : v.size_cm)
    )),
    [p.variants, color, sizeMode]
  );

  const selected: Variant | undefined = p.variants.find(v =>
    v.color === color && (sizeMode === "eu" ? v.size_eu === size : v.size_cm === size)
  );

  const canAdd = !!user && !!selected && qty > 0 && (selected?.stock ?? 0) > 0;

  async function addToCart() {
    if (!user) { toast.error(t("please_login")); return; }
    if (!selected) { toast.error(t("select_options")); return; }
    if (selected.stock <= 0) { toast.error(t("out_of_stock")); return; }
    await api.post("/api/orders/cart/", { product: p.id, variant: (selected as any).id, quantity: qty });
    toast.success("Added to cart");
  }

  const hero = heroSrc(p);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <Toaster position="top-center" />
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative z-10 max-w-3xl w-full mx-4 rounded-2xl bg-zinc-950 border border-zinc-800 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="bg-zinc-900">
            {hero && (
              <img src={hero} alt={name} className="w-full h-80 object-cover" loading="lazy" />
            )}
          </div>
          <div className="p-4 space-y-3">
            <div className="text-lg font-semibold">{name}</div>
            <Price base={p.base_price} salePercent={p.sale_percent} salePrice={p.sale_price} />
            <p className="text-sm text-zinc-300">{desc}</p>

            <div className="space-y-2">
              <div className="text-xs uppercase text-zinc-400">{t("color")}</div>
              <div className="flex gap-2 flex-wrap">
                {colors.map(c => (
                  <button key={c}
                    onClick={() => { setColor(c); setSize(""); }}
                    className={`px-2 py-1 rounded border ${color===c?"border-brand-primary bg-zinc-800":"border-zinc-700"}`}
                  >{c}</button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-xs uppercase text-zinc-400">{t("size")}</div>
              <div className="flex gap-2">
                <button onClick={()=>{setSizeMode("eu"); setSize("");}} className={`text-xs px-2 py-1 rounded ${sizeMode==="eu"?"bg-zinc-800 border border-brand-primary":"bg-zinc-900 border border-zinc-700"}`}>{t("eu")}</button>
                <button onClick={()=>{setSizeMode("cm"); setSize("");}} className={`text-xs px-2 py-1 rounded ${sizeMode==="cm"?"bg-zinc-800 border border-brand-primary":"bg-zinc-900 border border-zinc-700"}`}>{t("cm")}</button>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              {sizes.map(s => (
                <button key={s}
                  onClick={()=>setSize(s)}
                  className={`px-2 py-1 rounded border ${size===s?"border-brand-primary bg-zinc-800":"border-zinc-700"}`}
                >{s}</button>
              ))}
            </div>

            {selected && (selected as any).stock <= 0 && (
              <div className="text-red-400 text-sm">{t("out_of_stock")}</div>
            )}

            <div className="flex items-center gap-3">
              <div className="text-xs">{t("quantity")}</div>
              <input
                type="number"
                min={1}
                value={qty}
                onChange={e=>setQty(Math.max(1, Number(e.target.value)))}
                className="w-20 bg-zinc-900 border border-zinc-700 rounded px-2 py-1"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={addToCart}
                className={`px-4 py-2 rounded font-semibold ${canAdd ? "bg-emerald-600 hover:bg-emerald-500" : "bg-zinc-700 cursor-not-allowed"}`}
              >
                {t("add_to_cart")}
              </button>
              <button onClick={onClose} className="px-4 py-2 rounded bg-zinc-800 hover:bg-zinc-700">Close</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
