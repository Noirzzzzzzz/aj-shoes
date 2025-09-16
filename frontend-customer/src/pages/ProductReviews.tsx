import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import api from "@/api/client";
import { Star } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import ReviewForm from "@/components/reviews/ReviewForm";

    type Review = {
    id: number;
    rating: number;
    comment: string;
    created_at: string;
    username?: string;
    };

    type PageResp =
    | { results: Review[]; count: number; page: number; page_size: number }
    | Review[]; // กรณี DRF ไม่มี paginator จะไม่เป็น object

    export default function ProductReviews() {
    const { id } = useParams(); // product id
    const [sp, setSp] = useSearchParams();
    const page = Number(sp.get("page") || 1);
    const pageSize = Number(sp.get("page_size") || 20);

    const [items, setItems] = useState<Review[]>([]);
    const [count, setCount] = useState<number>(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let ignore = false;
        async function load() {
        setLoading(true);
        try {
            const { data } = await api.get<PageResp>("/api/orders/reviews", {
            params: { product: id, page, page_size: pageSize },
            });

            if (ignore) return;

            if (Array.isArray(data)) {
            // fallback no-paginator: สมมติทั้งก้อนคือหน้าเดียว
            setItems(data);
            setCount(data.length);
            } else {
            setItems(data.results || []);
            setCount(data.count || 0);
            }
        } finally {
            if (!ignore) setLoading(false);
        }
        }
        load();
        return () => { ignore = true; };
    }, [id, page, pageSize]);

    const totalPages = useMemo(() => Math.max(1, Math.ceil(count / pageSize)), [count, pageSize]);

    type ReviewSummary = {
    average: number;
    total: number;
    stars: Record<string, number>;
    };

    const [summary, setSummary] = useState<ReviewSummary | null>(null);

    useEffect(() => {
        async function loadSummary() {
            try {
            const { data } = await api.get<ReviewSummary>("/api/orders/reviews/aggregate/", {
                params: { product: id },
            });
            setSummary(data);
            } catch (e) {
            // เงียบ error
            }
        }
        loadSummary();
        }, [id]);

    const { user } = useAuth();

    return (
        <div className="mx-auto max-w-3xl p-4">
        <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold">All Reviews</h1>
            <Link to={`/product/${id}`} className="text-emerald-400 hover:underline">
            ← Back to product
            </Link>
        </div>
        {user && (
        <div className="mb-6 p-4 rounded border border-zinc-800 bg-zinc-900">
            <h2 className="text-base font-semibold mb-2">Write a Review</h2>
            <ReviewForm productId={Number(id)} />
        </div>
        )}
        {summary && (
        <div className="mb-6 p-4 rounded border border-zinc-800 bg-zinc-900">
            <div className="text-lg font-semibold mb-2">
            Average {summary.average.toFixed(1)} ★ ({summary.total} reviews)
            </div>
            <div className="space-y-1">
            {Object.entries(summary.stars).sort(([a], [b]) => Number(b) - Number(a)).map(([star, count]) => (
                <div key={star} className="flex items-center gap-2">
                <div className="w-10 text-right">{star}★</div>
                <div className="flex-1 bg-zinc-800 rounded h-3 overflow-hidden">
                    <div
                    className="bg-emerald-500 h-3"
                    style={{ width: summary.total ? `${(count / summary.total) * 100}%` : "0%" }}
                    />
                </div>
                <div className="w-8 text-sm text-zinc-400">{count}</div>
                </div>
            ))}
            </div>
        </div>
        )}

        {loading ? (
            <div className="text-zinc-400">Loading…</div>
        ) : items.length === 0 ? (
            <div className="text-zinc-400">No reviews yet.</div>
        ) : (
            <ul className="space-y-3">
            {items.map(rv => (
                <li key={rv.id} className="rounded border border-zinc-800 bg-zinc-900 p-3">
                <div className="flex items-center gap-2">
                    <div className="text-sm font-medium">{rv.username || "user"}</div>
                    <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={14} className={i < (rv.rating || 0) ? "fill-yellow-400 text-yellow-400" : "text-zinc-600"} />
                    ))}
                    </div>
                    <div className="text-xs text-zinc-500 ml-auto">
                    {new Date(rv.created_at).toLocaleString()}
                    </div>
                </div>
                {rv.comment && <p className="mt-1 text-sm text-zinc-300 whitespace-pre-wrap">{rv.comment}</p>}
                </li>
            ))}
            </ul>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
            <div className="flex items-center gap-2 mt-6 justify-center">
            <button
                onClick={() => setSp({ page: String(Math.max(1, page - 1)), page_size: String(pageSize) })}
                disabled={page <= 1}
                className={`px-3 py-1 rounded border ${page <= 1 ? "opacity-40 cursor-not-allowed" : "hover:bg-zinc-800"}`}
            >
                Prev
            </button>
            <div className="text-sm">Page {page} / {totalPages}</div>
            <button
                onClick={() => setSp({ page: String(Math.min(totalPages, page + 1)), page_size: String(pageSize) })}
                disabled={page >= totalPages}
                className={`px-3 py-1 rounded border ${page >= totalPages ? "opacity-40 cursor-not-allowed" : "hover:bg-zinc-800"}`}
            >
                Next
            </button>
            </div>
        )}
        </div>
    );
    }
