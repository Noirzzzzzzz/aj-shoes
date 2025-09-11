import { useCallback, useEffect, useMemo, useState } from "react";
import { addFavorite, fetchFavorites, removeFavoriteByProduct, removeFavoriteById, type Favorite } from "@/api/favorites";

export default function useFavorites() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);

  const map = useMemo(() => {
    const m = new Map<number, Favorite>();
    favorites.forEach(f => m.set(f.product, f));
    return m;
  }, [favorites]);

  const isFav = useCallback((productId: number) => map.has(productId), [map]);

  const reload = useCallback(async () => {
    setLoading(true);
    try { setFavorites(await fetchFavorites()); }
    finally { setLoading(false); }
  }, []);

const toggle = useCallback(async (productId: number) => {
  // หา favorite ตัวเดียวกันใน state เพื่อรู้ pk
  const current = favorites.find(f => f.product === productId);

  if (isFav(productId)) {
    const prev = favorites;
    setFavorites(prev.filter(f => f.product !== productId));     // optimistic remove
    try {
      // ลองลบแบบ ?product=<id> ก่อน
      await removeFavoriteByProduct(productId);
    } catch {
      try {
        // ถ้าเออร์เรอร์ ให้ fallback ไปลบด้วย pk แทน
        if (current?.id) await removeFavoriteById(current.id);
        else throw new Error("No favorite id to delete");
      } catch {
        setFavorites(prev); // rollback ถ้ายังลบไม่ได้
      }
    }
  } else {
    const prev = favorites;
    setFavorites([{ id: -productId, product: productId }, ...prev]);  // optimistic add
    try {
      const saved = await addFavorite(productId);
      setFavorites([saved, ...prev]);
    } catch {
      setFavorites(prev);
    }
  }
}, [favorites, isFav]);

  useEffect(() => { reload(); }, [reload]);

  return { favorites, loading, isFav, toggle, reload };
}
