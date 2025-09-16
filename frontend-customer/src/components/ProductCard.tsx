import { useMemo } from "react";
import { Product } from "@/types";
import Price from "./Price";
import RatingStars from "./RatingStars";
import { optImg } from "@/utils/img";
import useFavorites from "@/hooks/useFavorites";

/* ---------- helpers ---------- */
function mediaUrl(path?: string): string | "" {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const base = (import.meta as any).env?.VITE_MEDIA_URL || "/media/";
  return `${String(base).replace(/\/$/, "")}/${String(path).replace(/^\//, "")}`;
}
function productCoverSrc(p: Product, w = 256, h = 256, q = 80): string {
  const cover = (p.images || []).find((im: any) => im.is_cover) || p.images?.[0];
  if (!cover) return "";
  const fileSrc = mediaUrl((cover as any).file);
  if (fileSrc) return fileSrc;
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
    <button
      onClick={onClick}
      className="relative block min-w-40 w-40 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-left overflow-hidden"
      aria-label={p.name_en}
    >
      {/* Favorite */}
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

      {/* รูป: กล่องสี่เหลี่ยมจัตุรัสเท่ากันทุกการ์ด + จัดรูปกึ่งกลางไม่บิดเบี้ยว */}
      <div className="w-full aspect-square bg-zinc-800 flex items-center justify-center">
        {src && (
          <img
            src={src}
            alt={p.name_en}
            className="max-h-full max-w-full object-contain"
            loading="lazy"
            draggable={false}
          />
        )}
      </div>

      {/* เนื้อหา */}
      <div className="p-2 space-y-1">
        {/* ชื่อ: บรรทัดเดียว + ... */}
        <div className="text-xs font-semibold whitespace-nowrap overflow-hidden text-ellipsis">
          {p.name_en}
        </div>

        <Price base={p.base_price} salePercent={p.sale_percent} salePrice={p.sale_price} />

        {/* ดาวจากรีวิวจริง + จำนวนรีวิว */}
        <div className="flex items-center gap-1">
          <RatingStars rating={p.average_rating || 0} />
          <span className="text-[11px] text-zinc-400">({p.review_count || 0})</span>
        </div>
      </div>
    </button>
  );
}
