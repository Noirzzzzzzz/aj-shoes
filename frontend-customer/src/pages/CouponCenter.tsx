// src/pages/CouponCenter.tsx — READY TO REPLACE
import { useEffect, useState } from "react";
import api from "@/api/client";
interface Coupon {
  id: number;
  code: string;
  discount_type: "percent" | "free_shipping";
  percent_off?: number;
  max_uses: number;
  uses_count: number;
  valid_to?: string | null;
  remaining?: number | null;
  claimed?: boolean;
}

async function getWithFallback(urls: string[]) {
  let lastErr: any = null;
  for (const u of urls) {
    try {
      const { data } = await api.get(u);
      return data;
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}
async function postWithFallback(pairs: Array<[string, any]>) {
  let lastErr: any = null;
  for (const [url, body] of pairs) {
    try {
      const { data } = await api.post(url, body);
      return data;
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

export default function CouponCenter() {
    const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadCoupons() {
    try {
      const data = await getWithFallback([
        "/api/coupons/center/",
        "/coupons/center/",
        "/api/coupons/coupons/center/", // เผื่อ path ซ้อน
      ]);
      setCoupons(data || []);
    } catch (e) {
      console.error("loadCoupons error", e);
      setCoupons([]);
    } finally {
      setLoading(false);
    }
  }

  async function claim(id: number) {
    // ✅ อัปเดต UI แบบ optimistic ทันที
    setCoupons((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              claimed: true,
              remaining:
                c.remaining === null || c.remaining === undefined
                  ? c.remaining
                  : Math.max(0, c.remaining - 1),
            }
          : c
      )
    );

    try {
      await postWithFallback([
        [`/api/coupons/${id}/claim/`, {}],
        [`/coupons/${id}/claim/`, {}],
        [`/api/coupons/coupons/${id}/claim/`, {}], // เผื่อ path ซ้อน
      ]);
      // ซิงก์กับเซิร์ฟเวอร์อีกครั้ง (กันกรณีมีคนอื่นเคลมพร้อมกัน)
      await loadCoupons();
    } catch (e: any) {
      // ❌ ถ้าล้มเหลว ให้ revert UI กลับ
      setCoupons((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                claimed: false,
                remaining:
                  c.remaining === null || c.remaining === undefined
                    ? c.remaining
                    : c.remaining + 1,
              }
            : c
        )
      );
      alert(e?.response?.data?.detail || "โปรดเข้าสู่ระบบก่อนเก็บคูปอง");
    }
  }

  useEffect(() => {
    loadCoupons();
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">{"ส่วนลด"}</h1>

      {loading ? (
        <div>กำลังโหลด...</div>
      ) : coupons.length === 0 ? (
        <div className="text-zinc-400">ยังไม่มีส่วนลดที่แจกอยู่ในขณะนี้</div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {coupons.map((c) => (
            <div key={c.id} className="p-4 border border-zinc-800 bg-zinc-900 rounded space-y-2">
              <div className="font-semibold text-lg">{c.code}</div>
              {c.discount_type === "percent" ? (
                <div className="text-emerald-400">ลด {c.percent_off}%</div>
              ) : (
                <div className="text-sky-400">ส่งฟรี</div>
              )}

              {c.remaining !== null && c.remaining !== undefined && (
                <div className="text-sm text-zinc-400">เหลือ {c.remaining} สิทธิ์</div>
              )}
              {c.valid_to && (
                <div className="text-sm text-zinc-400">
                  หมดเขต: {new Date(c.valid_to).toLocaleString()}
                </div>
              )}

              <button
                disabled={c.claimed}
                onClick={() => claim(c.id)}
                className={`w-full px-3 py-2 rounded ${
                  c.claimed
                    ? "bg-zinc-700 text-zinc-400 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white"
                }`}
              >
                {c.claimed ? "เก็บแล้ว" : "เก็บคูปอง"}
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
