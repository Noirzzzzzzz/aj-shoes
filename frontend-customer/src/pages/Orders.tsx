import { useEffect, useState } from "react";
import Protected from "@/components/Protected";
import api from "@/api/client";
import { fmt } from "@/utils/format";

type OrderItem = {
  id: number;
  product: number;
  variant: number;
  price: string;        // decimal string from API
  quantity: number;
  product_detail?: { name?: string; name_en?: string };
  variant_detail?: { name?: string };
};

type Order = {
  id: number;
  status: "pending" | "shipped" | "delivered";
  shipping_carrier: string;
  shipping_cost: string;
  coupon: number | null;
  total: string;
  items: OrderItem[];
  created_at: string;
};

export default function Orders() {
  return (
    <Protected>
      <OrdersInner />
    </Protected>
  );
}

function OrdersInner() {
  const [orders, setOrders] = useState<Order[] | null>(null);

  useEffect(() => {
    (async () => {
      const res = await api.get("/api/orders/history/");
      setOrders(res.data);
    })();
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 space-y-4">
      <h1 className="text-xl font-bold">ประวัติคำสั่งซื้อ</h1>

      {!orders ? (
        <div className="text-zinc-400">กำลังโหลด...</div>
      ) : orders.length === 0 ? (
        <div className="text-zinc-400">ยังไม่มีประวัติคำสั่งซื้อ</div>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <div key={o.id} className="p-4 rounded border border-zinc-800 bg-zinc-900">
              <div className="flex items-center justify-between">
                <div className="font-semibold">คำสั่งหมายเลข: {o.id}</div>
                <span className={
                  "px-2 py-0.5 rounded text-sm " +
                  (o.status === "pending" ? "bg-amber-600/30 text-amber-300" :
                   o.status === "shipped" ? "bg-sky-600/30 text-sky-300" :
                   "bg-emerald-600/30 text-emerald-300")
                }>
                  {o.status}
                </span>
              </div>
              <div className="mt-1 text-sm text-zinc-400">{new Date(o.created_at).toLocaleString()}</div>

              <div className="mt-3 border-t border-zinc-800 pt-3 space-y-1 text-sm">
                <div>ผู้จัดส่ง: {o.shipping_carrier}</div>
                <div>การจัดส่ง: {fmt.currency(Number(o.shipping_cost))}</div>
                <div>ยอดชำระเงินทั้งหมด: <span className="font-semibold">{fmt.currency(Number(o.total))}</span></div>
                {o.coupon && <div>ส่วนลด: #{o.coupon}</div>}
              </div>

              <div className="mt-3 border-t border-zinc-800 pt-3">
                <div className="text-sm text-zinc-400 mb-1">สินค้า: </div>
                <ul className="space-y-1 text-sm">
                  {o.items.map((it) => (
                    <li key={it.id} className="flex justify-between">
                      <span>
                        {it.product_detail?.name_en || it.product_detail?.name || `#${it.product}`} × {it.quantity}
                      </span>
                      <span>{fmt.currency(Number(it.price) * it.quantity)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {o.status === "pending" && (
                <div className="mt-3 text-sm text-amber-300">
                  กำลังรอการยืนยันจากแอดมิน
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
