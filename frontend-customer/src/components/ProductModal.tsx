import { useState, useMemo, useEffect } from "react";
import { Product, Variant } from "@/types";
import Price from "./Price";
import { useAuth } from "@/context/AuthContext";
import api from "@/api/client";
import toast, { Toaster } from "react-hot-toast";
import { optImg } from "@/utils/img";
import { Star } from "lucide-react";

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

  /** ========= states เดิม ========= **/
  const [color, setColor] = useState<string>("");
  const [sizeMode, setSizeMode] = useState<"eu"|"cm">("eu");
  const [size, setSize] = useState<string>("");
  const [qty, setQty] = useState<number>(1);

  const [qtyInput, setQtyInput] = useState<string | undefined>(undefined);

  const name = (p as any).name_en || (p as any).name;
  const desc = (p as any).description_th || (p as any).description_en || (p as any).description;

  const colors = useMemo(() => Array.from(new Set(p.variants.map(v => v.color))), [p.variants]);
  // helper: key ของไซส์ตามโหมด
  const sizeKey = (v: Variant) => (sizeMode === "eu" ? v.size_eu : v.size_cm);

  // สีไหน “มีสต็อกบ้างไหม” (ใช้ตัดสินใจ disable สี)
  // ถ้าสีหนึ่งมีทุกไซส์หมดสต็อก => disabled
  const colorInStock = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const v of p.variants) {
      const st = (v as any).stock ?? 0;
      map[v.color] = map[v.color] || st > 0;
    }
    return map; // true = มีสต็อกอย่างน้อย 1 ไซส์
  }, [p.variants]);

  // รวมไซส์ทั้งหมดของสินค้านี้ (สำหรับกรณียังไม่เลือกสีก็โชว์ได้)
  const sizesAll = useMemo(
    () => Array.from(new Set(p.variants.map((v) => sizeKey(v)))),
    [p.variants, sizeMode]
  );

  // ไซส์ “ที่ยังมีสต็อก” ภายใต้บริบทของสีที่เลือก (ถ้าไม่เลือกสี → ดูทุกสี)
  const sizeInStockMap = useMemo(() => {
    const can: Record<string, boolean> = {};
    for (const s of sizesAll) can[s] = false;
    for (const v of p.variants) {
      if (color && v.color !== color) continue; // เลือกสีแล้ว: พิจารณาเฉพาะสีนั้น
      const st = (v as any).stock ?? 0;
      if (st > 0) can[sizeKey(v)] = true;
    }
    return can; // true = ไซส์นี้มีสต็อกให้เลือก
  }, [p.variants, color, sizeMode, sizesAll]);

  // รายการไซส์ที่จะแสดง (ถ้าไม่เลือกสี → ทุกไซส์, ถ้าเลือกแล้ว → ไซส์ของสีนั้น)
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

  // ถ้าเปลี่ยนสี/โหมดแล้วไซส์ที่เลือกอยู่ไม่มีสต็อกหรือไม่อยู่ในชุดปัจจุบัน → ล้างไซส์
  useEffect(() => {
    if (!size) return;
    if (!sizesToShow.includes(size) || !sizeInStockMap[size]) {
      setSize("");
    }
  }, [color, sizeMode, sizesToShow, sizeInStockMap, size]);

  const selected: Variant | undefined = p.variants.find(v =>
    v.color === color && (sizeMode === "eu" ? v.size_eu === size : v.size_cm === size)
  );

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
    const arr = useColorImages(p, c);
    const start = arr.findIndex((im: any) => im?.is_cover);
    setImgIndex(start >= 0 ? start : 0);
  }

  /** ========= cart ========= **/
  const canAdd = !!user && !!selected && qty > 0 && (selected?.stock ?? 0) > 0;
  async function addToCart() {
    if (!user) { toast.error("กรุณาเข้าสู่ระบบ"); return; }
    if (!selected) { toast.error("กรุณาเลือก สี/ไซส์ ให้ครบก่อน"); return; }
    if ((selected as any).stock <= 0) { toast.error("สินค้าหมด"); return; }
    await api.post("/api/orders/cart/", { product: (p as any).id, variant: (selected as any).id, quantity: qty });
    toast.success("เพิ่มสินค้าลงตะกร้าแล้ว");
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
      } catch (e) {
        // เงียบได้ ไม่ต้องโชว์ error
      }
    }
    load();
  }, [p?.id]);

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
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        className="relative z-10 w-full max-w-5xl max-h-[90vh] h-[90vh] rounded-2xl bg-zinc-950 border border-zinc-800 overflow-hidden"
        onClick={(e) => e.stopPropagation()}   // กันคลิกทะลุ
      >
        <div className="grid grid-cols-1 md:grid-cols-[560px_1fr] h-full">
          {/* ซ้าย: รูปหลัก + thumbnails (ตรึง, ไม่เลื่อน) */}
          <div className="md:sticky md:top-0 md:self-start h-full">
            <div className="h-full rounded-2xl overflow-hidden bg-zinc-900 flex flex-col">
              {/* รูปหลัก: กินพื้นที่ที่เหลือทั้งหมด */}
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

              {/* thumbnails: แถวล่างสูงคงที่ (ไม่ทำให้เกิดพื้นที่ทึบเกิน) */}
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

          {/* ====== ขวา: รายละเอียดสินค้า + เลือกสี/ไซส์ + รีวิว (เลื่อนในคอลัมน์) ====== */}
          <div className="p-4 space-y-4 overflow-y-auto h-[90vh]">
            <div className="text-lg font-semibold">{name}</div>
            <Price base={(p as any).base_price} salePercent={(p as any).sale_percent} salePrice={(p as any).sale_price} />
            <div className="text-sm text-zinc-400">
              {selected ? <span>Stock: {(selected as any).stock ?? 0}</span> : null}
            </div>

            {/* สี */}
            <div className="space-y-2">
              <div className="text-xs uppercase text-zinc-400">{"color"}</div>
              <div className="flex gap-2 flex-wrap">
                {colors.map((c) => {
                  const disabled = !colorInStock[c]; // หมดทุกไซส์ → true
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
                <button onClick={()=>{setSizeMode("eu"); setSize("");}} className={`text-xs px-2 py-1 rounded ${sizeMode==="eu"?"bg-zinc-800 border border-emerald-500":"bg-zinc-900 border border-zinc-700"}`}>{"eu"}</button>
                <button onClick={()=>{setSizeMode("cm"); setSize("");}} className={`text-xs px-2 py-1 rounded ${sizeMode==="cm"?"bg-zinc-800 border border-emerald-500":"bg-zinc-900 border border-zinc-700"}`}>{"cm"}</button>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              {sizesToShow.map((s) => {
                const disabled = !sizeInStockMap[s];
                return (
                  <button
                    key={s}
                    onClick={() => !disabled && setSize(s)}
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
                  onFocus={() => setQtyInput("")}                // คลิกแล้วว่าง
                  onChange={(e) => {
                    // รับเฉพาะตัวเลข
                    const v = e.target.value.replace(/\D+/g, "");
                    setQtyInput(v);
                  }}
                  onBlur={() => {
                    const n = qtyInput === "" ? NaN : Number(qtyInput);
                    const safe = Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
                    setQty(safe);
                    setQtyInput(undefined); // กลับไปโชว์โหมดปกติ
                  }}
                  className="w-16 bg-zinc-900 px-2 py-1 text-center"
                  placeholder="1"
                  aria-label="quantity"
                />

                <button
                  onClick={() => setQty(q => q + 1)}
                  className="px-3 py-1"
                  aria-label="increase quantity"
                >
                  +
                </button>
              </div>
            </div>

            {/* ปุ่ม */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={addToCart}
                className={`px-4 py-2 rounded font-semibold ${canAdd ? "bg-emerald-600 hover:bg-emerald-500" : "bg-zinc-700 cursor-not-allowed"}`}
              >
                {"เพิ่มลงตะกร้า"}
              </button>
              <button onClick={onClose} className="px-4 py-2 rounded bg-zinc-800 hover:bg-zinc-700">Close</button>
            </div>

            {/* รายละเอียดสินค้า (บล็อคเหนือ Reviews) */}
            <div className="pt-4 border-t border-zinc-800 space-y-3">
              <div className="text-base font-semibold">Details</div>
              <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
                <div className="text-sm text-zinc-300 whitespace-pre-wrap">
                  {desc}
                </div>
              </div>
            </div>

            {/* รีวิว */}
                        {/* รีวิว (ตัวอย่าง 10 รายการ) */}
            <div className="pt-4 border-t border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-base font-semibold">Reviews</div>

                {/* จำนวนรีวิวคลิกไปหน้ารีวิวเต็ม */}
                <button
                  onClick={() => {
                    // เปลี่ยนเป็นเส้นทางหน้ารีวิวของคุณตามที่ใช้จริง
                    // ตัวอย่าง: /product/<id>/reviews
                    window.location.href = `/product/${(p as any).id}/reviews`;
                  }}
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

              {/* ปุ่มดูทั้งหมด (สำรอง นอกจากกดที่ตัวเลขข้างบน) */}
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
