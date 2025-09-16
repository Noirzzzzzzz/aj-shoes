import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/api/client";

type ReviewDTO = {
  id: number;
  product: number;
  rating: number;
  comment: string;
  created_at: string;
  updated_at?: string;
  username: string;
};

type ReviewListProps = {
  productId?: number;
  mine?: boolean;
  onReloadRef?: (fn: () => Promise<void>) => void;
};

function Stars({ value }: { value: number }) {
  const v = Math.max(1, Math.min(5, Math.round(value)));
  return (
    <span aria-label={`${v} stars`} className="text-amber-400">
      {"★★★★★".slice(0, v)}
      <span className="text-zinc-600">{"★★★★★".slice(v)}</span>
    </span>
  );
}

function fmt(s?: string) {
  if (!s) return "";
  try { return new Date(s).toLocaleString(); } catch { return s; }
}

export default function ReviewList(props: ReviewListProps) {
  const { productId, mine = false, onReloadRef } = props;
  const { user } = useAuth();
  const [rows, setRows] = useState<ReviewDTO[]>([]);
  const [loading, setLoading] = useState(false);

  const currentUsername = user?.username || "";

  async function fetchData(): Promise<void> {
    try {
      setLoading(true);
      if (mine) {
        try {
          const r1 = await api.get("/api/orders/reviews/", { params: { mine: true } });
          if (Array.isArray(r1.data)) { setRows(r1.data); return; }
        } catch (_) {}
        const resAll = await api.get("/api/orders/reviews/");
        const all: ReviewDTO[] = Array.isArray(resAll.data) ? resAll.data : [];
        setRows(all.filter(r => r.username === currentUsername));
      } else if (productId) {
        const res = await api.get("/api/orders/reviews/", { params: { product: productId } });
        setRows(Array.isArray(res.data) ? res.data : []);
      } else {
        setRows([]);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    if (onReloadRef) onReloadRef(fetchData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, mine, currentUsername]);

  const count = useMemo(() => rows.length, [rows]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-base font-semibold">{mine ? "My Reviews" : "Reviews"}</div>
        <div className="text-xs text-zinc-400">{count} {count === 1 ? "review" : "reviews"}</div>
      </div>

      {loading ? (
        <div className="text-sm text-zinc-400">Loading...</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-zinc-400">
          {mine ? "You haven’t written any reviews yet." : "No reviews yet"}
        </div>
      ) : (
        <div className={mine ? "space-y-3" : "space-y-3 max-h-56 overflow-auto pr-1"}>
          {rows.map((r) => (
            <div key={r.id} className="rounded border border-zinc-800 bg-zinc-900 p-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">{r.username || (mine ? "You" : "User")}</div>
                <Stars value={r.rating} />
              </div>
              {r.comment && <div className="text-sm text-zinc-200 mt-1 whitespace-pre-wrap">{r.comment}</div>}
              <div className="text-xs text-zinc-500 mt-1">{fmt(r.updated_at || r.created_at)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
