import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/api/client";
import toast from "react-hot-toast";

type ReviewDTO = {
  id: number;
  product: number;
  rating: number;
  comment: string;
  created_at: string;
  updated_at?: string;
  username: string;
};

type ReviewFormProps = {
  productId: number;
  onChanged?: () => void;
  className?: string;
};

export default function ReviewForm({ productId, onChanged, className }: ReviewFormProps) {
  const { user } = useAuth();
  const [myReview, setMyReview] = useState<ReviewDTO | null>(null);
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const isOwner = useMemo(() => !!myReview, [myReview]);

  async function loadMine(): Promise<void> {
    if (!user?.username) return;
    try {
      const r1 = await api.get("/api/orders/reviews/", { params: { product: productId, mine: true } });
      if (Array.isArray(r1.data) && r1.data.length) {
        setMyReview(r1.data[0]);
        setRating(r1.data[0].rating);
        setComment(r1.data[0].comment || "");
        return;
      }
    } catch (_) {}
    try {
      const res = await api.get("/api/orders/reviews/", { params: { product: productId } });
      const rows: ReviewDTO[] = Array.isArray(res.data) ? res.data : [];
      const mine = rows.find(r => r.username === user?.username);
      if (mine) {
        setMyReview(mine);
        setRating(mine.rating);
        setComment(mine.comment || "");
      } else {
        setMyReview(null);
        setRating(5);
        setComment("");
      }
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    loadMine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, user?.username]);

  async function handleSubmit(): Promise<void> {
    if (!user) { toast.error("Please login"); return; }
    try {
      setLoading(true);
      if (myReview) {
        await api.patch(`/api/orders/reviews/${myReview.id}/`, { rating, comment });
        toast.success("Review updated");
      } else {
        await api.post(`/api/orders/reviews/`, { product: productId, rating, comment });
        toast.success("Review submitted");
      }
      await loadMine();
      onChanged?.();
    } catch (e: any) {
      const msg =
        e?.response?.data?.detail ||
        "You must purchase this product before writing a review."; // ✅ fallback ใหม่
      toast.error(typeof msg === "string" ? msg : "You must purchase this product before writing a review.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(): Promise<void> {
    if (!myReview) return;
    try {
      setLoading(true);
      await api.delete(`/api/orders/reviews/${myReview.id}/`);
      toast.success("Review deleted");
      setMyReview(null);
      setRating(5);
      setComment("");
      onChanged?.();
    } catch {
      toast.error("Unable to delete review");
    } finally {
      setLoading(false);
    }
  }

  if (!user) {
    return (
      <div className={className || ""}>
        <div className="text-sm text-zinc-400">Please login to write a review.</div>
      </div>
    );
  }

  return (
    <div className={`rounded border border-zinc-800 bg-zinc-900 p-3 space-y-2 ${className || ""}`}>
      <div className="text-sm font-medium">{isOwner ? "Edit your review" : "Write a review"}</div>
      <div className="flex items-center gap-3">
        <label className="text-sm text-zinc-400">Rating</label>
        <select
          className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1"
          value={rating}
          onChange={(e)=>setRating(Number(e.target.value))}
          disabled={loading}
        >
          {[5,4,3,2,1].map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>
      <textarea
        className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
        rows={3}
        placeholder="Share your experience…"
        value={comment}
        onChange={(e)=>setComment(e.target.value)}
        disabled={loading}
      />
      <div className="flex items-center gap-2">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60"
        >
          {isOwner ? "Save" : "Submit"}
        </button>
        {isOwner && (
          <button
            onClick={handleDelete}
            disabled={loading}
            className="px-3 py-1 rounded bg-red-600 hover:bg-red-500 disabled:opacity-60"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
