import { useState, useMemo, useEffect } from "react";
import { Product, Variant } from "@/types";
import Price from "./Price";
import { useAuth } from "@/context/AuthContext";
import api from "@/api/client";
import toast, { Toaster } from "react-hot-toast";
import { optImg } from "@/utils/img";
import { Star } from "lucide-react";
import useFavorites from "@/hooks/useFavorites";

/** ========= helpers ========= **/
function mediaUrl(path?: string): string | "" {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const base = (import.meta as any).env?.VITE_MEDIA_URL || "/media/";
  return `${String(base).replace(/\/$/, "")}/${String(path).replace(/^\//, "")}`;
}
function imageSrc(raw: any, w = 960, h = 960, q = 90): string {
  const fileSrc = mediaUrl(raw?.file);
  if (fileSrc) return fileSrc;
  const u = raw?.image_url || "";
  return u ? optImg(u, { w, h, fit: "cover", q }) : "";
}
type ProductImage = { file?: string; image_url?: string; is_cover?: boolean; color?: string };

/** เลือกรูปตามสี (ถ้ารูปมีฟิลด์ color) */
function useColorImages(p: Product, color: string): ProductImage[] {
  const imgs: ProductImage[] = (p as any).images || [];
  const hasColor = imgs.some((im: any) => im?.color);
  if (!imgs.length) return imgs;
  if (hasColor && color) {
    const byColor = imgs.filter((im: any) => (im.color || "").toLowerCase() === color.toLowerCase());
    return byColor.length ? byColor : imgs;
  }
  return imgs;
}

export default function ProductModal({ p, onClose }:{ p: Product; onClose: () => void; }) {
  const { user } = useAuth();
  const { isFav, toggle } = useFavorites();
  const fav = useMemo(() => isFav((p as any).id), [isFav, p?.id]);

  /** ========= states เดิม ========= **/
  const [color, setColor] = useState<string>("");
  const [sizeMode, setSizeMode] = useState<"eu"|"cm">("eu");
  const [size, setSize] = useState<string>("");
  const [qty, setQty] = useState<number>(1);
  const [qtyInput, setQtyInput] = useState<string | undefined>(undefined);

  // ✅ ติดตาม quantity ที่มีในตะกร้าแล้ว
  const [cartQuantities, setCartQuantities] = useState<Record<number, number>>({});
  const [loadingCart, setLoadingCart] = useState<boolean>(false);

  const name = (p as any).name_en || (p as any).name;
  const desc = (p as any).description_th || (p as any).description_en || (p as any).description;

  const colors = useMemo(() => Array.from(new Set(p.variants.map(v => v.color))), [p.variants]);
  // helper: key ของไซส์ตามโหมด
  const sizeKey = (v: Variant) => (sizeMode === "eu" ? v.size_eu : v.size_cm);

  // สีไหน "มีสต็อกบ้างไหม" (ใช้ตัดสินใจ disable สี)
  const colorInStock = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const v of p.variants) {
      const st = (v as any).stock ?? 0;
      map[v.color] = map[v.color] || st > 0;
    }
    return map; // true = มีสต็อกอย่างน้อย 1 ไซส์
  }, [p.variants]);

  // รวมไซส์ทั้งหมด
  const sizesAll = useMemo(
    () => Array.from(new Set(p.variants.map((v) => sizeKey(v)))),
    [p.variants, sizeMode]
  );

  // ไซส์ที่ยังมีสต็อกตามสีที่เลือก
  const sizeInStockMap = useMemo(() => {
    const can: Record<string, boolean> = {};
    for (const s of sizesAll) can[s] = false;
    for (const v of p.variants) {
      if (color && v.color !== color) continue;
      const st = (v as any).stock ?? 0;
      if (st > 0) can[sizeKey(v)] = true;
    }
    return can;
  }, [p.variants, color, sizeMode, sizesAll]);

  // รายการไซส์ที่จะแสดง
  const sizesToShow = useMemo(() => {
    if (!color) return sizesAll;
    return Array.from(
      new Set(
        p.variants
          .filter((v) => v.color === color)
          .map((v) => sizeKey(v))
      )
    );
  }, [p.variants, color, sizeMode, sizesAll]);

  // ถ้าเปลี่ยนสี/โหมดแล้วไซส์ที่เลือกไม่อยู่ในชุด → ล้าง
  useEffect(() => {
    if (!size) return;
    if (!sizesToShow.includes(size) || !sizeInStockMap[size]) {
      setSize("");
    }
  }, [color, sizeMode, sizesToShow, sizeInStockMap, size]);

  const selected: Variant | undefined = p.variants.find(v =>
    v.color === color && (sizeMode === "eu" ? v.size_eu === size : v.size_cm === size)
  );

  // ✅ available stock = stock จริง - ในตะกร้าแล้ว
  const availableStock = useMemo(() => {
    if (!selected) return 0;
    const variantId = (selected as any).id;
    const inCart = cartQuantities[variantId] || 0;
    const totalStock = (selected as any).stock ?? 0;
    return Math.max(0, totalStock - inCart);
  }, [selected, cartQuantities]);

  // ✅ โหลด cart quantities
  useEffect(() => {
    async function loadCartQuantities() {
      if (!user) return;
      setLoadingCart(true);
      try {
        const { data } = await api.get("/api/orders/cart/");
        const quantities: Record<number, number> = {};
        if (data.items && Array.isArray(data.items)) {
          data.items.forEach((item: any) => {
            const variantId = item.variant;
            quantities[variantId] = (quantities[variantId] || 0) + item.quantity;
          });
        }
        setCartQuantities(quantities);
      } catch (error) {
        console.error("Failed to load cart quantities:", error);
      } finally {
        setLoadingCart(false);
      }
    }
    loadCartQuantities();
  }, [user]);

  // เปลี่ยน maxQty ให้ใช้ availableStock แทน
  const maxQty = useMemo(() => Math.max(1, availableStock), [availableStock]);

  // ✅ ตรวจ qty เมื่อเปลี่ยน variant
  useEffect(() => {
    if (selected) {
      const stock = (selected as any).stock ?? 0;
      if (qty > stock) setQty(Math.max(1, Math.min(qty, stock)));
    }
  }, [selected, qty]);

  /** ========= แกลเลอรีตามสี ========= **/
  const images = useColorImages(p, color);
  const startIndex = useMemo(() => {
    const idx = images.findIndex((im: any) => im?.is_cover);
    return idx >= 0 ? idx : 0;
  }, [images]);
  const [imgIndex, setImgIndex] = useState<number>(startIndex);
  useEffect(() => { setImgIndex(startIndex); }, [startIndex, color]);

  function prevImg() { setImgIndex(i => images.length ? (i - 1 + images.length) % images.length : 0); }
  function nextImg() { setImgIndex(i => images.length ? (i + 1) % images.length : 0); }

  function onPickColor(c: string) {
    setColor(c);
    setSize("");
    setQty(1);
    const arr = useColorImages(p, c);
    const start = arr.findIndex((im: any) => im?.is_cover);
    setImgIndex(start >= 0 ? start : 0);
  }

  /** ========= cart ========= **/
  const canAdd = !!user && !!selected && qty > 0 && availableStock >= qty;
  async function addToCart() {
    if (loadingCart) {
      toast.error("กำลังโหลดข้อมูลตะกร้า กรุณารอสักครู่");
      return;
    }
    if (!user) { toast.error("กรุณาเข้าสู่ระบบ"); return; }
    if (!selected) { toast.error("กรุณาเลือก สี/ไซส์ ให้ครบก่อน"); return; }
    if (availableStock <= 0) { toast.error("ไม่สามารถเพิ่มได้ สินค้าหมดหรือตะกร้าเต็มแล้ว"); return; }
    if (qty <= 0) { toast.error("กรุณาระบุจำนวนที่ถูกต้อง"); setQty(1); return; }
    if (qty > availableStock) { 
      toast.error(`ไม่สามารถเพิ่มได้ เพิ่มได้อีกเพียง ${availableStock} ชิ้น`); 
      setQty(Math.max(1, availableStock));
      return; 
    }

    try {
      await api.post("/api/orders/cart/", { 
        product: (p as any).id, 
        variant: (selected as any).id, 
        quantity: qty 
      });
      const variantId = (selected as any).id;
      setCartQuantities(prev => ({ ...prev, [variantId]: (prev[variantId] || 0) + qty }));
      setQty(1);
      toast.success(`เพิ่ม ${qty} ชิ้น ลงตะกร้าแล้ว`);
    } catch (error: any) {
      const errorMsg = error?.response?.data?.detail;
      if (errorMsg && errorMsg.includes("stock")) {
        toast.error("สินค้าไม่เพียงพอ กำลังรีโหลดข้อมูล...");
        window.location.reload();
      } else {
        toast.error(errorMsg || "เกิดข้อผิดพลาด");
      }
    }
  }

  type ReviewItem = { id: number; username: string; rating: number; comment: string; created_at: string };
  const [reviewsTotal, setReviewsTotal] = useState<number>(0);
  const [reviewsPreview, setReviewsPreview] = useState<ReviewItem[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get(`/api/orders/reviews/summary/`, {
          params: { product: (p as any).id, limit: 10 },
        });
        setReviewsTotal(data?.total ?? 0);
        setReviewsPreview(data?.items ?? []);
      } catch {}
    }
    load();
  }, [p?.id]);

  // lock scroll หน้าเว็บเมื่อเปิด modal
  useEffect(() => {
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <Toaster position="top-center" />
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        onClick={onClose}
      />
      {/* modal */}
      <div
        className="relative z-10 w-full max-w-5xl max-h-[90vh] h-[90vh] rounded-2xl bg-zinc-950 border border-zinc-800 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ===== มุมขวาบน: Favorites + Close (X) ===== */}
        <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
          {/* Favorites */}
          <button
            type="button"
            aria-label={fav ? "Remove from favorites" : "Add to favorites"}
            title={fav ? "Unfavorite" : "Favorite"}
            onClick={(e) => { e.stopPropagation(); toggle((p as any).id); }}
            className={"rounded-full p-2 backdrop-blur bg-black/40 hover:bg-black/60 " + (fav ? "text-red-500" : "text-white")}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill={fav ? "currentColor" : "none"} stroke={fav ? "currentColor" : "Grey"} strokeWidth="2">
              <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1 7.8 7.8 7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z" />
            </svg>
          </button>
          {/* Close X */}
          <button
            type="button"
            aria-label="Close"
            title="Close"
            onClick={onClose}
            className="rounded-full p-2 backdrop-blur bg-black/40 hover:bg-black/60 text-white"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[560px_1fr] h-full">
          {/* ซ้าย: รูปหลัก + thumbnails */}
          <div className="md:sticky md:top-0 md:self-start h-full">
            <div className="h-full rounded-2xl overflow-hidden bg-zinc-900 flex flex-col">
              <div className="relative flex-1">
                {images.length > 0 && (
                  <img
                    src={imageSrc(images[Math.max(0, Math.min(imgIndex, images.length-1))])}
                    alt={name}
                    className="absolute inset-0 w-full h-full object-contain"
                  />
                )}
                {images.length > 1 && (
                  <>
                    <button
                      aria-label="Previous image"
                      onClick={prevImg}
                      className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 hover:bg-black/70 px-2 py-1"
                    >‹</button>
                    <button
                      aria-label="Next image"
                      onClick={nextImg}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 hover:bg-black/70 px-2 py-1"
                    >›</button>
                  </>
                )}
              </div>

              {images.length > 1 && (
                <div className="flex gap-2 p-2 overflow-x-auto border-t border-zinc-800 h-30">
                  {images.map((im, i) => (
                    <button
                      key={i}
                      onClick={() => setImgIndex(i)}
                      className={`relative h-20 w-20 flex-shrink-0 rounded overflow-hidden border ${i===imgIndex?"border-emerald-500":"border-transparent"}`}
                      aria-label={`Preview ${i+1}`}
                    >
                      <img src={imageSrc(im, 240, 240, 70)} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ขวา: รายละเอียด + เลือกสี/ไซส์ + รีวิว */}
          <div className="p-4 space-y-4 overflow-y-auto h:[90vh] md:h-[90vh]">
            <div className="text-lg font-semibold">{name}</div>
            <Price base={(p as any).base_price} salePercent={(p as any).sale_percent} salePrice={(p as any).sale_price} />
            <div className="text-sm text-zinc-400">
              {selected ? (
                <div className="space-y-1">
                  <div>Stock: {(selected as any).stock ?? 0}</div>
                  {cartQuantities[(selected as any).id] > 0 && (
                    <div className="text-amber-400 text-xs">
                      ในตะกร้าแล้ว: {cartQuantities[(selected as any).id]} ชิ้น
                    </div>
                  )}
                  <div className="text-emerald-400 text-xs">
                    เพิ่มได้อีก: {availableStock} ชิ้น
                  </div>
                  {availableStock <= 5 && availableStock > 0 && (
                    <span className="text-amber-400 text-xs">⚠️ เหลือน้อย</span>
                  )}
                  {availableStock <= 0 && (
                    <span className="text-red-400 text-xs">❌ ไม่สามารถเพิ่มได้</span>
                  )}
                </div>
              ) : null}
            </div>

            {/* สี */}
            <div className="space-y-2">
              <div className="text-xs uppercase text-zinc-400">{"color"}</div>
              <div className="flex gap-2 flex-wrap">
                {colors.map((c) => {
                  const disabled = !colorInStock[c];
                  return (
                    <button
                      key={c}
                      onClick={() => !disabled && onPickColor(c)}
                      disabled={disabled}
                      className={`px-2 py-1 rounded border transition ${
                        color === c
                          ? "border-emerald-500 bg-zinc-800"
                          : "border-zinc-700"
                      } ${disabled ? "opacity-40 cursor-not-allowed line-through" : ""}`}
                      aria-pressed={color === c}
                      title={c}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ไซส์ */}
            <div className="flex items-center gap-3">
              <div className="text-xs uppercase text-zinc-400">{"size"}</div>
              <div className="flex gap-2">
                <button onClick={()=>{setSizeMode("eu"); setSize(""); setQty(1);}} className={`text-xs px-2 py-1 rounded ${sizeMode==="eu"?"bg-zinc-800 border border-emerald-500":"bg-zinc-900 border border-zinc-700"}`}>{"eu"}</button>
                <button onClick={()=>{setSizeMode("cm"); setSize(""); setQty(1);}} className={`text-xs px-2 py-1 rounded ${sizeMode==="cm"?"bg-zinc-800 border border-emerald-500":"bg-zinc-900 border border-zinc-700"}`}>{"cm"}</button>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              {sizesToShow.map((s) => {
                const disabled = !sizeInStockMap[s];
                return (
                  <button
                    key={s}
                    onClick={() => !disabled && (setSize(s), setQty(1))}
                    disabled={disabled}
                    className={`px-2 py-1 rounded border transition ${
                      size === s ? "border-emerald-500 bg-zinc-800" : "border-zinc-700"
                    } ${disabled ? "opacity-40 cursor-not-allowed line-through" : ""}`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>

            {/* จำนวน */}
            {selected && (selected as any).stock <= 0 && (
              <div className="text-red-400 text-sm">{"สินค้าหมด"}</div>
            )}
            <div className="flex items-center gap-3">
              <div className="text-xs">Qty</div>
              <div className="flex items-center rounded border border-zinc-700">
                <button
                  onClick={() => setQty(q => Math.max(1, q - 1))}
                  className={`px-3 py-1 ${qty <= 1 ? "opacity-40 cursor-not-allowed" : ""}`}
                  disabled={qty <= 1}
                  aria-label="decrease quantity"
                >
                  -
                </button>

                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={qtyInput ?? String(qty)}
                  onFocus={() => setQtyInput("")}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D+/g, "");
                    setQtyInput(v);
                  }}
                  onBlur={() => {
                    const n = qtyInput === "" ? NaN : Number(qtyInput);
                    const safe = Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
                    const limited = Math.min(safe, Math.max(1, availableStock));
                    setQty(limited);
                    if (safe > availableStock && availableStock > 0) {
                      toast.error(`เพิ่มได้อีกเพียง ${availableStock} ชิ้น`);
                    } else if (availableStock <= 0) {
                      toast.error("ไม่สามารถเพิ่มได้ (ตะกร้าเต็มแล้ว)");
                    }
                    setQtyInput(undefined);
                  }}
                  className="w-16 bg-zinc-900 px-2 py-1 text-center"
                  placeholder="1"
                  aria-label="quantity"
                />

                <button
                  onClick={() => {
                    const newQty = qty + 1;
                    if (newQty <= availableStock) setQty(newQty);
                    else {
                      if (availableStock > 0) toast.error(`เพิ่มได้อีกเพียง ${availableStock} ชิ้น`);
                      else toast.error("ไม่สามารถเพิ่มได้ (ตะกร้าเต็มแล้ว)");
                    }
                  }}
                  className={`px-3 py-1 ${qty >= availableStock ? "opacity-40 cursor-not-allowed" : ""}`}
                  disabled={qty >= availableStock}
                  aria-label="increase quantity"
                >
                  +
                </button>
              </div>
              {selected && (
                <div className="text-xs text-zinc-400">
                  เพิ่มได้อีก {availableStock} ชิ้น
                </div>
              )}
            </div>

            {/* ปุ่ม */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={addToCart}
                disabled={!canAdd}
                className={`px-4 py-2 rounded font-semibold transition ${
                  canAdd 
                    ? "bg-emerald-600 hover:bg-emerald-500 cursor-pointer" 
                    : "bg-zinc-700 cursor-not-allowed opacity-60"
                }`}
                title={
                  !user ? "กรุณาเข้าสู่ระบบ" :
                  !selected ? "กรุณาเลือกสีและไซส์" :
                  qty <= 0 ? "กรุณาระบุจำนวน" :
                  availableStock <= 0 ? "ไม่สามารถเพิ่มได้ (ตะกร้าเต็มแล้ว)" :
                  qty > availableStock ? `เพิ่มได้อีกเพียง ${availableStock} ชิ้น` :
                  "เพิ่มลงตะกร้า"
                }
              >
                {"เพิ่มลงตะกร้า"}
              </button>
              {/* ปุ่ม 'ปิด' เดิมถูกย้ายไปเป็นไอคอนกากบาทมุมขวาบน */}
            </div>

            {/* รายละเอียดสินค้า */}
            <div className="pt-4 border-t border-zinc-800 space-y-3">
              <div className="text-base font-semibold">Details</div>
              <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
                <div className="text-sm text-zinc-300 whitespace-pre-wrap">
                  {desc}
                </div>
              </div>
            </div>

            {/* รีวิว (ตัวอย่าง 10 รายการ) */}
            <div className="pt-4 border-t border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-base font-semibold">Reviews</div>
                <button
                  onClick={() => { window.location.href = `/product/${(p as any).id}/reviews`; }}
                  className="text-sm text-emerald-400 hover:text-emerald-300 underline"
                >
                  {reviewsTotal} {reviewsTotal === 1 ? "review" : "reviews"}
                </button>
              </div>

              {reviewsPreview.length === 0 ? (
                <div className="text-sm text-zinc-400">ยังไม่มีรีวิว</div>
              ) : (
                <ul className="space-y-2">
                  {reviewsPreview.map((rv) => (
                    <li key={rv.id} className="rounded border border-zinc-800 bg-zinc-900 p-3">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium">{rv.username || "user"}</div>
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} size={14} className={i < (rv.rating || 0) ? "fill-yellow-400 text-yellow-400" : "text-zinc-600"} />
                          ))}
                        </div>
                      </div>
                      {rv.comment && (
                        <p className="mt-1 text-sm text-zinc-300 whitespace-pre-wrap">
                          {rv.comment}
                        </p>
                      )}
                      <div className="mt-1 text-xs text-zinc-500">{new Date(rv.created_at).toLocaleString()}</div>
                    </li>
                  ))}
                </ul>
              )}

              {reviewsTotal > reviewsPreview.length && (
                <div className="pt-1">
                  <button
                    onClick={() => (window.location.href = `/product/${(p as any).id}/reviews`)}
                    className="text-sm text-emerald-400 hover:text-emerald-300 underline"
                  >
                    ดูรีวิวทั้งหมด
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
