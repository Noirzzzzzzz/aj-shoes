// Cart.tsx — Fixed: Remove local pruning and sync from backend instead
import { useEffect, useMemo, useRef, useState } from "react";
import Protected from "@/components/Protected";
import api from "@/api/client";
import { fmt } from "@/utils/format";

/* ---------- Types ---------- */
interface Item {
  id: number;
  quantity: number;
  product_detail: {
    name_en: string;
    sale_price: number;
    images: Array<{ image_url: string; is_cover: boolean }>;
  };
  variant_detail: {
    color_label?: string;
    color_name?: string;
    color?: string;
    size_label?: string;
    size?: string;
    size_eu?: number;
    size_us?: number;
    size_cm?: number;
  };
}

interface Address {
  id: number;
  full_name: string;
  phone: string;
  address: string;
  province: string;
  postal_code: string;
  is_default: boolean;
}

interface PaymentConfig {
  bank_name: string;
  account_name: string;
  account_number: string;
  qr_code_url: string;
}

interface Order {
  id: number;
  total: number;
  status: string;
  payment_deadline: string;
}

type CouponType = "percent" | "free_shipping" | "unknown";
interface MyCoupon {
  id: number;
  code: string;
  discount_type: CouponType;
  percent_off?: number | null;
  valid_to?: string | null;
}

/* ---------- Payment Modal ---------- */
function PaymentRequired({
  order,
  paymentConfig,
  onPaymentComplete,
  onCancel,
  actualTotal,
}: {
  order: Order;
  paymentConfig: PaymentConfig;
  onPaymentComplete: () => void;
  onCancel: () => void;
  actualTotal?: number;
}) {
  const [paymentSlip, setPaymentSlip] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState("");
  const [isExpired, setIsExpired] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!order?.payment_deadline) return;
    const timer = setInterval(() => {
      const diff = new Date(order.payment_deadline).getTime() - Date.now();
      if (diff <= 0) {
        setIsExpired(true);
        setTimeRemaining("00:00");
        clearInterval(timer);
      } else {
        const m = Math.floor(diff / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setTimeRemaining(`${m}:${String(s).padStart(2, "0")}`);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [order]);

  const uploadPaymentSlip = async () => {
    if (!paymentSlip) return alert("กรุณาเลือกภาพสลิปการชำระเงิน");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("payment_slip", paymentSlip);
      await api.post(`/api/orders/orders/${order.id}/upload-payment/`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      alert("อัปโหลดสลิปเรียบร้อยแล้ว! กรุณารออดมินยืนยัน");
      onPaymentComplete();
    } catch (e: any) {
      alert(e?.response?.data?.detail || "อัปโหลดสลิปไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  };

  const cancelOrder = async () => {
    if (!confirm("ยกเลิกคำสั่งซื้อ? สินค้าจะถูกคืนเข้าตะกร้า")) return;
    try {
      await api.post(`/api/orders/orders/${order.id}/cancel/`);
      onCancel();
      alert("ยกเลิกคำสั่งซื้อแล้ว");
    } catch {
      onCancel();
      alert("ดำเนินการยกเลิกแล้ว กรุณาตรวจสอบตะกร้า");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-900 rounded-lg p-8 max-w-md w-full border border-zinc-800 max-h-[90vh] overflow-y-auto">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-white mb-2">ชำระเงิน</h1>
          <div className="text-emerald-400 text-2xl font-bold">
            ยอดชำระเงินทั้งหมด: {fmt.currency(actualTotal || order.total)}
          </div>
          <div className="text-sm text-zinc-400 mt-2">
            คำสั่งซื้อหมดอายุ: {new Date(order.payment_deadline).toLocaleString()}
          </div>
        </div>

        <div className="bg-white rounded-lg p-2 mb-6">
          <div className="flex justify-center">
            <img src={paymentConfig.qr_code_url} alt="Payment QR" className="w-full h-auto max-w-sm rounded" />
          </div>
        </div>

        <div className="space-y-3 mb-6 text-sm">
          <div className="flex justify-between"><span className="text-zinc-400">Bank:</span><span className="text-white">{paymentConfig.bank_name}</span></div>
          <div className="flex justify-between"><span className="text-zinc-400">Account:</span><span className="text-white">{paymentConfig.account_name}</span></div>
          <div className="flex justify-between"><span className="text-zinc-400">Number:</span><span className="text-white">{paymentConfig.account_number}</span></div>
        </div>

        <div className="text-center mb-6">
          <div className={`text-lg font-mono ${isExpired ? "text-red-500" : "text-yellow-400"}`}>
            เวลาที่เหลือ: {timeRemaining}
          </div>
          {isExpired && <div className="text-red-400 text-sm mt-1">หมดเวลาการชำระเงิน</div>}
        </div>

        <div className="mb-6">
          <label className="block text-sm text-zinc-400 mb-2">อัปโหลดสลิปชำระเงิน:</label>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={(e) => setPaymentSlip(e.target.files?.[0] || null)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-emerald-600 file:text-white"
          />
          {paymentSlip && <div className="text-sm text-green-400 mt-1">เลือก {paymentSlip.name} แล้ว</div>}
        </div>

        <div className="space-y-3">
          <button
            onClick={uploadPaymentSlip}
            disabled={uploading || isExpired || !paymentSlip}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:opacity-50 text-white font-medium py-3 rounded"
          >
            {uploading ? "Uploading..." : "ยืนยันการชำระเงิน"}
          </button>
          <button
            onClick={cancelOrder}
            disabled={uploading}
            className="w-full bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white py-3 rounded"
          >
            ยกเลิก
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Cart Main ---------- */
export default function Cart() {
  return (
    <Protected>
      <CartInner />
    </Protected>
  );
}

function CartInner() {
  // cart & selection
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  // shipping/discount states
  const [shippingBase, setShippingBase] = useState<number>(50);
  const [freeShipping, setFreeShipping] = useState<boolean>(false);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [appliedCodes, setAppliedCodes] = useState<string[]>([]);

  // addresses & carrier
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [selectedCarrier, setSelectedCarrier] = useState<string>("Kerry");

  // coupon picker modal + my coupons
  const [showPicker, setShowPicker] = useState(false);
  const [myPercent, setMyPercent] = useState<MyCoupon[]>([]);
  const [myFree, setMyFree] = useState<MyCoupon[]>([]);
  const [pickPercent, setPickPercent] = useState<string | null>(null);
  const [pickFree, setPickFree] = useState<string | null>(null);

  // payment modal
  const [placing, setPlacing] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);

  // loading states for coupons
  const [applyingCoupons, setApplyingCoupons] = useState(false);
  const [removingCoupon, setRemovingCoupon] = useState<string | null>(null);

  /* ---------- Derived ---------- */
  const chosen = useMemo(() => items.filter((it) => selected[it.id]), [items, selected]);
  const subtotal = useMemo(
    () => chosen.reduce((acc, it) => acc + Number(it.product_detail.sale_price) * it.quantity, 0),
    [chosen]
  );
  const effectiveShipping = useMemo(
    () => (chosen.length > 0 ? (freeShipping ? 0 : shippingBase) : 0),
    [chosen.length, freeShipping, shippingBase]
  );
  const total = useMemo(
    () => Math.max(0, subtotal - discountAmount + effectiveShipping),
    [subtotal, discountAmount, effectiveShipping]
  );

  /* ---------- Helpers ---------- */
  const cover = (it: Item) => {
    const imgs = it.product_detail?.images || [];
    const c = imgs.find((i) => i.is_cover) || imgs[0];
    return c?.image_url || "";
  };

  const brief = (it: Item) => {
    const v = it.variant_detail || {};
    const color = v.color_label || v.color_name || v.color || "";
    const sizeRaw = v.size_label ?? v.size ?? v.size_eu ?? v.size_us ?? v.size_cm ?? "";
    const size = sizeRaw !== "" && sizeRaw !== undefined ? ` ${String(sizeRaw)}` : "";
    const parts: string[] = [];
    if (color) parts.push(color);
    if (size.trim()) {
      let prefix = "";
      if (v.size_eu !== undefined) prefix = "EU";
      else if (v.size_us !== undefined) prefix = "US";
      else if (v.size_cm !== undefined) prefix = "CM";
      parts.push(prefix ? `${prefix}${size}` : size.trim());
    }
    return parts.join(" • ");
  };

  /* ---------- Sync from backend cart ---------- */
  function syncFromServerCart(data: any) {
    const srvShip = typeof data?.shipping_fee === "number" ? Number(data.shipping_fee) : 50;
    setShippingBase(srvShip);

    const isFree =
      Boolean(data?.free_shipping) ||
      (data?.applied_coupons || []).some((c: any) => c?.discount_type === "free_shipping") ||
      srvShip === 0;
    setFreeShipping(isFree);

    const amt = typeof data?.discount_amount === "number" ? Number(data.discount_amount) : 0;
    setDiscountAmount(amt);

    const pct = typeof data?.discount_percent === "number" ? Number(data.discount_percent) : 0;
    setDiscountPercent(pct);

    const acodes = (data?.applied_coupons || []).map((c: any) => c?.code).filter(Boolean);
    setAppliedCodes(acodes);
  }

  /* ---------- Data Loading ---------- */
  async function loadCart() {
    try {
      const { data } = await api.get("/api/orders/cart/");
      const list: Item[] = data.items || [];
      setItems(list);
      
      // เก็บ selection state เดิมไว้ แต่ลบ items ที่ไม่มีแล้ว
      setSelected(prev => {
        const next: Record<number, boolean> = {};
        list.forEach((it) => {
          // ใช้ selection เดิม หรือ default เป็น true สำหรับ item ใหม่
          next[it.id] = prev[it.id] !== undefined ? prev[it.id] : true;
        });
        return next;
      });
      
      syncFromServerCart(data);
    } catch (e) {
      console.error("loadCart error", e);
      alert("ไม่สามารถโหลดตะกร้าสินค้าได้");
    }
  }

  async function loadAddresses() {
    try {
      const res = await api.get("/api/orders/addresses/");
      const list: Address[] = res.data || [];
      setAddresses(list);
      setSelectedAddressId(list.length ? (list.find((a) => a.is_default)?.id ?? list[0].id) : null);
    } catch (e) {
      console.error("loadAddresses error", e);
      alert("ไม่สามารถโหลดที่อยู่ได้");
    }
  }

  async function loadMyCoupons() {
    try {
      const { data } = await api.get("/api/coupons/mine/");
      setMyPercent(data.percent || []);
      setMyFree(data.free_shipping || []);
    } catch (e) {
      console.error("loadMyCoupons error", e);
      alert("ไม่สามารถโหลดคูปองได้");
    }
  }

  useEffect(() => {
    loadCart();
    loadAddresses();
  }, []);

  useEffect(() => {
    if (showPicker) loadMyCoupons();
  }, [showPicker]);

  useEffect(() => {
    if (!selectAllRef.current) return;
    const totalCount = items.length;
    const checkedCount = items.filter((it) => selected[it.id]).length;
    selectAllRef.current.indeterminate = checkedCount > 0 && checkedCount < totalCount;
  }, [items, selected]);

  /* ---------- Cart Operations ---------- */
  async function updateQty(id: number, q: number) {
    try {
      await api.patch(`/api/orders/cart/${id}/`, { quantity: q });
      const keep = { ...selected };
      await loadCart();
      setSelected(keep);
    } catch (error) {
      console.error("Update quantity failed:", error);
      alert("ไม่สามารถอัปเดตจำนวนสินค้าได้");
    }
  }

  async function removeItem(id: number) {
    try {
      await api.delete(`/api/orders/cart/${id}/`);
      await loadCart();
    } catch (error) {
      console.error("Remove item failed:", error);
      alert("ไม่สามารถลบสินค้าได้");
    }
  }

  /* ---------- Coupon Operations ---------- */
  async function applyPickedCoupons() {
    const codes = [pickPercent, pickFree].filter(Boolean) as string[];

    if (codes.length === 0) {
      return setShowPicker(false);
    }

    setApplyingCoupons(true);

    try {
      const response = await api.post("/api/orders/cart/apply-coupon/", {
        coupon_codes: codes,
      });

      if (response.data) {
        const hasDiscount =
          response.data.discount_amount > 0 ||
          response.data.free_shipping ||
          (response.data.applied_coupons && response.data.applied_coupons.length > 0);

        if (hasDiscount) {
          syncFromServerCart(response.data);
        } else {
          alert("ไม่สามารถใช้คูปองได้ กรุณาตรวจสอบเงื่อนไข");
        }
      }
    } catch (error: any) {
      console.error("Apply coupon failed:", error);
      alert(`Error: ${error.response?.data?.detail || "ไม่สามารถใช้คูปองได้"}`);
    } finally {
      setApplyingCoupons(false);
    }

    setShowPicker(false);
    setPickPercent(null);
    setPickFree(null);
  }

  async function clearCoupons(code?: string) {
    if (code) setRemovingCoupon(code);

    try {
      let response;

      // ✅ Workaround: ใช้ apply-coupon กับ empty array แทน
      if (code) {
        // ลบคูปองที่ระบุ - ส่ง codes ที่เหลือ
        const remainingCodes = appliedCodes.filter(c => c !== code);
        response = await api.post("/api/orders/cart/apply-coupon/", { 
          coupon_codes: remainingCodes 
        });
      } else {
        // ลบคูปองทั้งหมด - ส่ง empty array
        response = await api.post("/api/orders/cart/apply-coupon/", { 
          coupon_codes: [] 
        });
      }

      console.log("Remove coupon response:", response.data);

      if (response.data) {
        syncFromServerCart(response.data);
        console.log("Synced from server:", {
          appliedCodes: response.data.applied_coupons?.map((c: { code: string }) => c.code),
          discountAmount: response.data.discount_amount,
          freeShipping: response.data.free_shipping
        });
      } else {
        console.log("No data returned, reloading cart");
        await loadCart();
      }
    } catch (e: any) {
      console.error("Remove coupon failed:", e);
      alert("ไม่สามารถลบคูปองได้");
      await loadCart();
    } finally {
      setRemovingCoupon(null);
    }
  }

  /* ---------- Checkout ---------- */
  async function checkout() {
    if (!selectedAddressId) return alert("Please select an address.");
    if (chosen.length === 0) return alert("Select at least 1 item.");

    try {
      setPlacing(true);

      const checkedIds = chosen.map((c) => c.id);
      const payload = {
        address_id: selectedAddressId,
        carrier: selectedCarrier || "Kerry",
        cart_item_ids: checkedIds,
      };

      const res = await api.post("/api/orders/cart/checkout/", payload);

      // ✅ ไม่ลบ items ใน UI ทันที แต่ให้ sync จาก backend แทน
      await loadCart(); // โหลดข้อมูลตะกร้าใหม่จาก backend

      if (res.data?.requires_payment) {
        setPaymentOrder(res.data.order);
        setPaymentConfig(res.data.payment_config);
        setShowPayment(true);
      } else {
        alert("Order placed successfully!");
        // เมื่อไม่มีขั้นตอนชำระเงิน → ไปหน้า orders ได้เลย
        window.location.href = "/orders";
      }
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Checkout failed. Please try again.");
      console.error("checkout error", err?.response || err);
      // ถ้า error → sync cart ปัจจุบันจากเซิร์ฟเวอร์กลับมา
      await loadCart();
    } finally {
      setPlacing(false);
    }
  }

  const onPaymentComplete = async () => {
    setShowPayment(false);
    setPaymentOrder(null);
    setPaymentConfig(null);
    // โหลดข้อมูลตะกร้าใหม่จาก backend เพื่ออัปเดท UI
    await loadCart();
    window.location.href = "/orders";
  };

  const onPaymentCancel = async () => {
    setShowPayment(false);
    setPaymentOrder(null);
    setPaymentConfig(null);
    // ยกเลิกการชำระเงิน → ดึงตะกร้าปัจจุบันจากเซิร์ฟเวอร์ (เผื่อ backend คืนสินค้า/คูปอง)
    await loadCart();
  };

  /* ---------- UI ---------- */
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 space-y-4">
      <h1 className="text-xl font-bold">ตะกร้าสินค้า</h1>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Items */}
        <div className="md:col-span-2 space-y-3">
          <div className="flex items-center gap-2 text-sm mb-1">
            <input
              ref={selectAllRef}
              type="checkbox"
              checked={items.length > 0 && items.every((it) => selected[it.id])}
              onChange={() => {
                const allOn = items.length > 0 && items.every((it) => selected[it.id]);
                const next: Record<number, boolean> = {};
                items.forEach((it) => (next[it.id] = !allOn));
                setSelected(next);
              }}
            />
            <span className="opacity-80">
              เลือกทั้งหมด{" "}
              <span className="opacity-60">
                ({items.filter((it) => selected[it.id]).length}/{items.length})
              </span>
            </span>
          </div>

          {items.length === 0 ? (
            <div className="text-zinc-400">ไม่มีสินค้าในตะกร้า</div>
          ) : (
            items.map((it) => (
              <div key={it.id} className="flex items-center gap-3 p-3 rounded border border-zinc-800 bg-zinc-900">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={!!selected[it.id]}
                  onChange={() => setSelected((p) => ({ ...p, [it.id]: !p[it.id] }))}
                />

                <div className="w-16 h-16 bg-zinc-800 rounded overflow-hidden flex-shrink-0">
                  {cover(it) ? (
                    <img src={cover(it)} alt={it.product_detail.name_en} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-[10px] text-zinc-500">no image</div>
                  )}
                </div>

                <div className="flex-1">
                  <div className="font-semibold text-sm">{it.product_detail.name_en}</div>
                  {brief(it) && <div className="text-xs text-zinc-400">{brief(it)}</div>}
                  <div className="text-xs text-zinc-400">{fmt.currency(it.product_detail.sale_price)} ×</div>
                </div>

                <input
                  type="number"
                  min={1}
                  value={it.quantity}
                  onChange={(e) => updateQty(it.id, Math.max(1, Number(e.target.value)))}
                  className="w-20 bg-zinc-900 border border-zinc-700 rounded px-2 py-1"
                />
                <button onClick={() => removeItem(it.id)} className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700">
                  ลบ
                </button>
              </div>
            ))
          )}
        </div>

        {/* Summary */}
        <div className="p-4 rounded border border-zinc-800 bg-zinc-900 space-y-3">
          {/* Address */}
          <div className="space-y-2">
            <div className="text-sm text-zinc-400">ที่อยู่จัดส่ง</div>
            <select
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
              value={selectedAddressId ?? ""}
              onChange={(e) => setSelectedAddressId(e.target.value ? Number(e.target.value) : null)}
            >
              {addresses.length === 0 ? (
                <option value="">ไม่มีที่อยู่ — เพิ่มในโปรไฟล์</option>
              ) : (
                addresses.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name} | {a.phone} | {a.address} {a.province} {a.postal_code}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Carrier */}
          <div className="space-y-2">
            <div className="text-sm text-zinc-400">เลือกผู้จัดส่ง</div>
            <select
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
              value={selectedCarrier}
              onChange={(e) => setSelectedCarrier(e.target.value)}
            >
              <option value="Kerry">Kerry</option>
              <option value="J&T">J&T</option>
              <option value="Flash">Flash</option>
              <option value="DHL">DHL</option>
            </select>
          </div>

          {/* Coupon Section */}
          <div className="space-y-2">
            <div className="text-sm text-zinc-400">เลือกส่วนลด</div>

            {/* Coupon Bar */}
            <div className="w-full rounded bg-zinc-950 border border-zinc-700 px-3 py-2">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Applied Coupons */}
                {appliedCodes.length > 0 ? (
                  appliedCodes.map((code) => (
                    <span
                      key={code}
                      className="inline-flex items-center gap-2 text-xs bg-emerald-800 border border-emerald-600 rounded-full px-2 py-1 text-white"
                    >
                      {code}
                      <button
                        onClick={() => clearCoupons(code)}
                        disabled={removingCoupon === code}
                        className="w-4 h-4 grid place-items-center rounded-full hover:bg-emerald-700 disabled:opacity-50 text-white"
                        title="ยกเลิกคูปองนี้"
                      >
                        {removingCoupon === code ? "•••" : "×"}
                      </button>
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-zinc-400">ยังไม่ได้เลือกส่วนลด</span>
                )}

                {/* Buttons */}
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => setShowPicker(true)}
                    disabled={applyingCoupons}
                    className="px-3 py-1 text-xs rounded bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
                  >
                    {applyingCoupons ? "กำลังใช้..." : "เลือกคูปอง"}
                  </button>
                  {appliedCodes.length > 0 && (
                    <button
                      onClick={() => clearCoupons()}
                      disabled={removingCoupon !== null}
                      className="px-3 py-1 text-xs rounded bg-red-600 hover:bg-red-500 text-white disabled:opacity-50"
                    >
                      {removingCoupon ? "กำลังลบ..." : "ลบทั้งหมด"}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Coupon Summary Card */}
            {(appliedCodes.length > 0 || freeShipping || discountAmount > 0) && (
              <div className="rounded border border-emerald-700/40 bg-emerald-900/20 p-3 text-sm text-emerald-300">
                <div className="font-semibold mb-1">Active Coupons</div>
                <div className="text-xs space-y-1">
                  <div>Codes: {appliedCodes.join(", ") || "None"}</div>
                  {freeShipping && <div>✓ Free shipping applied</div>}
                  {discountAmount > 0 && (
                    <div>✓ Discount{discountPercent ? ` (${discountPercent}%)` : ""}: −{fmt.currency(discountAmount)}</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Totals */}
          <div className="border-t border-zinc-800 pt-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span>สินค้าราคา</span>
              <span>{fmt.currency(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm text-rose-300">
                <span>ลดราคา{discountPercent ? ` (${discountPercent}%)` : ""}</span>
                <span>-{fmt.currency(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span>ค่าจัดส่ง{freeShipping ? " (free)" : ""}</span>
              <span className={freeShipping ? "text-emerald-400 line-through" : ""}>
                {fmt.currency(effectiveShipping)}
              </span>
            </div>
            <div className="flex justify-between font-semibold text-lg text-emerald-400 border-t border-zinc-700 pt-2">
              <span>ยอดชำระเงินทั้งหมด</span>
              <span>{fmt.currency(total)}</span>
            </div>
          </div>

          <button
            disabled={placing || chosen.length === 0}
            onClick={checkout}
            className="w-full px-4 py-3 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 font-medium"
          >
            {placing ? "กำลังดำเนินการ..." : "ชำระเงิน"}
          </button>

          {chosen.length === 0 && items.length > 0 && (
            <p className="text-xs text-amber-400 text-center">กรุณาเลือกสินค้าอย่างน้อย 1 รายการ</p>
          )}
        </div>
      </div>

      {/* Coupon Picker Modal */}
      {showPicker && (
        <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w/full max-w-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">เลือกส่วนลด</h3>
              <button
                onClick={() => setShowPicker(false)}
                disabled={applyingCoupons}
                className="text-sm text-zinc-400 hover:text-white disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="border border-zinc-800 rounded p-3">
                <div className="font-medium mb-2">ส่วนลด (%)</div>
                <div className="space-y-2 max-h-64 overflow-auto pr-1">
                  {myPercent.length === 0 && <div className="text-zinc-500 text-sm">ไม่มีโค้ดส่วนลด</div>}
                  {myPercent.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="percentPick"
                        checked={pickPercent === c.code}
                        onChange={() => setPickPercent(c.code)}
                        disabled={applyingCoupons}
                      />
                      <div className="flex-1">
                        <div className="font-semibold">
                          {c.code} — {c.percent_off}%
                        </div>
                        {c.valid_to && (
                          <div className="text-xs text-zinc-400">หมดอายุ: {new Date(c.valid_to).toLocaleString()}</div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="border border-zinc-800 rounded p-3">
                <div className="font-medium mb-2">ส่งฟรี</div>
                <div className="space-y-2 max-h-64 overflow-auto pr-1">
                  {myFree.length === 0 && <div className="text-zinc-500 text-sm">ไม่มีโค้ดส่งฟรี</div>}
                  {myFree.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="freePick"
                        checked={pickFree === c.code}
                        onChange={() => setPickFree(c.code)}
                        disabled={applyingCoupons}
                      />
                      <div className="flex-1">
                        <div className="font-semibold">{c.code}</div>
                        {c.valid_to && (
                          <div className="text-xs text-zinc-400">หมดอายุ: {new Date(c.valid_to).toLocaleString()}</div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowPicker(false)}
                disabled={applyingCoupons}
                className="px-4 py-2 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={applyPickedCoupons}
                disabled={applyingCoupons || (!pickPercent && !pickFree)}
                className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
              >
                {applyingCoupons ? "กำลังใช้คูปอง..." : "ใช้คูปอง"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPayment && paymentOrder && paymentConfig && (
        <PaymentRequired
          order={paymentOrder}
          paymentConfig={paymentConfig}
          onPaymentComplete={onPaymentComplete}
          onCancel={onPaymentCancel}
          actualTotal={total}
        />
      )}
    </main>
  );
}