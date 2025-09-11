import { useMemo } from "react";
import { Product } from "@/types";
import Price from "./Price";
import RatingStars from "./RatingStars";
import { optImg } from "@/utils/img";
import useFavorites from "@/hooks/useFavorites"; // ใช้ฮุค favorites

// สร้างตัวช่วยแปลง path ของไฟล์ใน MEDIA ให้เป็น URL ใช้งานได้จริง
function mediaUrl(path?: string): string | "" {
  if (!path) return "";
  // ถ้า backend ส่งมาเป็น absolute URL อยู่แล้ว ก็ใช้ได้เลย
  if (/^https?:\/\//i.test(path)) return path;
  // ไม่งั้น prefix ด้วย MEDIA_URL (กำหนดใน .env ของ frontend เป็น VITE_MEDIA_URL)
  const base = (import.meta as any).env?.VITE_MEDIA_URL || "/media/";
  return `${String(base).replace(/\/$/, "")}/${String(path).replace(/^\//, "")}`;
}

function productCoverSrc(p: Product, w = 256, h = 256, q = 80): string {
  const cover = p.images.find((im: any) => im.is_cover) || p.images[0];
  if (!cover) return "";

  // 1) ถ้ามีไฟล์ (เราคุมคุณภาพ/ความเสถียรได้) → ใช้ไฟล์เรา
  const fileSrc = mediaUrl((cover as any).file);
  if (fileSrc) return fileSrc;

  // 2) ถ้าไม่มีไฟล์ → fallback ใช้ตัว optimizer ของเราแปลงจาก image_url
  const u = (cover as any).image_url || "";
  return u ? optImg(u, { w, h, fit: "cover", q }) : "";
}

export default function ProductCard({
  p,
  onClick,
  showFavorite = true,
}: {
  p: Product;
  onClick: () => void;
  showFavorite?: boolean;
}) {
  const src = productCoverSrc(p);

  const { isFav, toggle } = useFavorites();
  const fav = useMemo(() => isFav(p.id), [isFav, p.id]);

  return (
    // ทำให้ปุ่มการ์ดเป็นตำแหน่งอ้างอิง (relative) แล้ววางหัวใจไว้ "ข้างใน"
    <button
      onClick={onClick}
      className="relative block min-w-40 w-40 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-left overflow-hidden"
      aria-label={p.name_en}
    >
      {/* ปุ่มหัวใจ: absolute อ้างอิงกับการ์ดนี้เสมอ */}
      {showFavorite && (
        <span
          role="button"
          aria-label={fav ? "Remove from favorites" : "Add to favorites"}
          title={fav ? "Unfavorite" : "Favorite"}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            toggle(p.id);
          }}
          className={
            "absolute right-2 top-2 z-10 rounded-full p-2 backdrop-blur " +
            (fav ? "bg-black/40 text-red-500" : "bg-black/40 hover:bg-black/60 text-white")
          }
        >
          {/* ใช้ currentColor → เมื่อ fav จะเป็นแดง */}
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill={fav ? "currentColor" : "none"}
            stroke={fav ? "currentColor" : "Grey"}
            strokeWidth="2"
          >
            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1 7.8 7.8 7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z" />
          </svg>
        </span>
      )}

      <div className="h-40 w-full bg-zinc-800">
        {src && <img src={src} alt={p.name_en} className="w-full h-full object-cover" loading="lazy" />}
      </div>
      <div className="p-2 space-y-1">
        <div className="text-xs font-semibold line-clamp-2">{p.name_en}</div>
        <Price base={p.base_price} salePercent={p.sale_percent} salePrice={p.sale_price} />
        <RatingStars rating={5} />
      </div>
    </button>
  );
}
