// src/pages/Cart.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import Protected from "@/components/Protected";
import api from "@/api/client";
import { fmt } from "@/utils/format";
import { useTranslation } from "react-i18next";

type Item = {
  id: number;                 // cart item id
  product: number;
  variant: number;
  quantity: number;
  product_detail: {
    id: number;
    name_en: string;
    base_price: string;
    sale_price: string;
    sale_percent: number;
    images: { image_url: string; is_cover: boolean }[];
  };
  variant_detail?: {
    color?: string;
    color_name?: string;
    color_label?: string;
    size?: string | number;
    size_label?: string;
    size_eu?: string | number;
    size_us?: string | number;
    size_cm?: string | number;
    stock?: number;
  };
};

type Coupon = {
  id: number;
  code: string;
  discount_type: "percent" | "free_shipping";
  percent_off: number;
  min_spend: number;
};

type CartData = {
  id: number;
  items: Item[];
  coupon: Coupon | null;
};

type Address = {
  id: number;
  full_name: string;
  phone: string;
  address: string;
  province: string;
  postal_code: string;
  is_default?: boolean;
};

type PaymentInfo = {
  id: number;
  qr_code_image: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  total_amount: number;
  expires_at: string;
};

export default function Cart() {
  return (
    <Protected>
      <CartInner />
    </Protected>
  );
}

function CartInner() {
  const { t } = useTranslation();

  // cart
  const [items, setItems] = useState<Item[]>([]);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [coupon, setCoupon] = useState("");
  const [shipping, setShipping] = useState(50);

  // selection
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  // totals with coupon calculation
  const chosen = useMemo(() => items.filter((it) => selected[it.id]), [items, selected]);
  const subtotal = useMemo(
    () => chosen.reduce((acc, it) => acc + Number(it.product_detail.sale_price) * it.quantity, 0),
    [chosen]
  );
  
  // Calculate discount
  const { discountAmount, finalShipping, total } = useMemo(() => {
    let discount = 0;
    let finalShipping = chosen.length > 0 ? shipping : 0;
    
    if (appliedCoupon && subtotal > 0) {
      if (appliedCoupon.discount_type === "percent") {
        // Check minimum spend
        if (subtotal >= appliedCoupon.min_spend) {
          discount = (subtotal * appliedCoupon.percent_off) / 100;
        }
      } else if (appliedCoupon.discount_type === "free_shipping") {
        if (subtotal >= appliedCoupon.min_spend) {
          finalShipping = 0;
        }
      }
    }
    
    const finalTotal = subtotal - discount + finalShipping;
    return { 
      discountAmount: discount, 
      finalShipping, 
      total: finalTotal 
    };
  }, [subtotal, shipping, chosen.length, appliedCoupon]);

  // address + carrier + placing
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [selectedCarrier, setSelectedCarrier] = useState<string>("Kerry");
  const [placing, setPlacing] = useState(false);

  // payment
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [paymentSlip, setPaymentSlip] = useState<File | null>(null);

  // ---------- helpers ----------
  const getCoverImage = (it: Item) => {
    const pd = it.product_detail;
    if (!pd || !pd.images) return "";
    const images = pd.images;
    if (!Array.isArray(images) || images.length === 0) return "";
    const coverImage = images.find(img => img.is_cover) || images[0];
    return coverImage?.image_url || "";
  };

  // สร้างข้อความรายละเอียด variant สั้นๆ เช่น "Black • EU 42"
  const getVariantBrief = (it: Item) => {
    const v = it.variant_detail || {};
    const color = (v.color_label as string) || (v.color_name as string) || (v.color as string) || "";
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

  // ---------- loads ----------
  async function loadCart() {
    try {
      const { data } = await api.get("/api/orders/cart/");
      const cartData: CartData = data;
      const list: Item[] = cartData.items || [];
      setItems(list);
      setAppliedCoupon(cartData.coupon);
      
      // เริ่มต้น: เลือกทั้งหมด
      const init: Record<number, boolean> = {};
      list.forEach((it) => (init[it.id] = true));
      setSelected(init);
    } catch (error) {
      console.error("Error loading cart:", error);
    }
  }

  async function loadAddresses() {
    try {
      const res = await api.get("/api/orders/addresses/");
      const list: Address[] = res.data || [];
      setAddresses(list);
      if (list.length > 0) {
        const def = list.find((a) => a.is_default);
        setSelectedAddressId((def?.id ?? list[0].id) as number);
      } else {
        setSelectedAddressId(null);
      }
    } catch (e) {
      console.error("failed to load addresses", e);
    }
  }

  useEffect(() => {
    loadCart();
    loadAddresses();
  }, []);

  // อัปเดตสถานะ indeterminate ของ Select all
  useEffect(() => {
    if (!selectAllRef.current) return;
    const totalCount = items.length;
    const checkedCount = items.filter((it) => selected[it.id]).length;
    selectAllRef.current.indeterminate = checkedCount > 0 && checkedCount < totalCount;
  }, [items, selected]);

  // ---------- cart operations ----------
  async function updateQty(id: number, q: number) {
    await api.patch(`/api/orders/cart/${id}/`, { quantity: q });
    const keep = { ...selected };
    await loadCart();
    setSelected((prev) => ({ ...keep }));
  }

  async function removeItem(id: number) {
    await api.delete(`/api/orders/cart/${id}/`);
    await loadCart();
  }

  async function applyCoupon() {
    if (!coupon.trim()) {
      alert("Please enter a coupon code.");
      return;
    }
    
    try {
      await api.post("/api/orders/cart/apply-coupon/", { code: coupon });
      setCoupon("");
      await loadCart();
      alert("Coupon applied successfully!");
    } catch (error: any) {
      const message = error?.response?.data?.detail || 
                     error?.response?.data?.non_field_errors?.[0] || 
                     "Failed to apply coupon. Please check the code.";
      alert(message);
    }
  }

  async function removeCoupon() {
    try {
      await api.post("/api/orders/cart/apply-coupon/", { code: "" });
      await loadCart();
    } catch (error) {
      console.error("Failed to remove coupon:", error);
    }
  }

  // ---------- selection helpers ----------
  const toggleItem = (id: number) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const allChecked = items.length > 0 && items.every((it) => selected[it.id]);

  const toggleAll = () => {
    const next: Record<number, boolean> = {};
    const checked = !(allChecked && !selectAllRef.current?.indeterminate);
    items.forEach((it) => (next[it.id] = checked));
    setSelected(next);
  };

  // ---------- checkout ----------
  async function checkout() {
    if (!selectedAddressId) {
      alert("Please select an address.");
      return;
    }
    if (chosen.length === 0) {
      alert("Select at least 1 item.");
      return;
    }
    
    const chosenIds = chosen.map((c) => c.id);
    
    try {
      setPlacing(true);
      const payload = {
        address_id: selectedAddressId,
        carrier: selectedCarrier || "Kerry",
        cart_item_ids: chosenIds,
      };
      
      // สร้าง order และได้ payment info กลับมา
      const response = await api.post("/api/orders/cart/checkout/", payload);
      const orderData = response.data;
      
      if (orderData.payment_info) {
        // ✅ ลบ cart items หลังจาก checkout สำเร็จ
        try {
          await api.post("/api/orders/cart/clear-cart-items/", {
            cart_item_ids: orderData.cart_item_ids || chosenIds
          });
        } catch (clearError) {
          console.warn("Failed to clear cart items:", clearError);
          // ไม่ต้อง throw error เพราะ order สำเร็จแล้ว
        }
        
        setPaymentInfo(orderData.payment_info);
        setItems([]);
        setCoupon("");
        setAppliedCoupon(null);
        setSelected({});
      } else {
        alert("Order created but payment info not available. Please contact admin.");
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        (typeof err?.response?.data === "string" && err.response.data) ||
        "Checkout failed. Please try again.";
      alert(msg);
      console.error("checkout error", err?.response || err);
      
      // ✅ ไม่ต้องลบ cart items เพราะ checkout failed
      // Items จะยังอยู่ใน cart ให้ลูกค้าลองใหม่ได้
    } finally {
      setPlacing(false);
    }
  }

  // ---------- payment slip upload ----------
  async function uploadPaymentSlip() {
    if (!paymentSlip || !paymentInfo) {
      alert("Please select a payment slip image.");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("slip", paymentSlip);
      formData.append("order_id", paymentInfo.id.toString());

      await api.post("/api/orders/upload-payment-slip/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("Payment slip uploaded successfully! Admin will verify your payment.");
      setPaymentInfo(null);
      setPaymentSlip(null);
      window.location.href = "/orders";
    } catch (error: any) {
      const message = error?.response?.data?.detail || "Failed to upload payment slip.";
      alert(message);
    }
  }

  // Payment Modal
  if (paymentInfo) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-bold text-center">Payment Required</h2>
          
          <div className="text-center space-y-2">
            <div className="text-2xl font-bold text-emerald-400">
              Total: {fmt.currency(paymentInfo.total_amount)}
            </div>
            <div className="text-sm text-zinc-400">
              Order expires: {new Date(paymentInfo.expires_at).toLocaleString()}
            </div>
          </div>

          <div className="flex justify-center">
            <div className="bg-white p-4 rounded-lg">
              <img 
                src={paymentInfo.qr_code_image} 
                alt="Payment QR Code" 
                className="w-64 h-64 object-contain"
              />
            </div>
          </div>

          <div className="text-center space-y-1 text-sm">
            <div><strong>Bank:</strong> {paymentInfo.bank_name}</div>
            <div><strong>Account:</strong> {paymentInfo.account_name}</div>
            <div><strong>Number:</strong> {paymentInfo.account_number}</div>
          </div>

          <div className="space-y-3">
            <div className="text-sm text-zinc-400">Upload Payment Slip:</div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setPaymentSlip(e.target.files?.[0] || null)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2"
            />
            {paymentSlip && (
              <div className="text-sm text-emerald-400">
                Selected: {paymentSlip.name}
              </div>
            )}
          </div>

          <button
            onClick={uploadPaymentSlip}
            disabled={!paymentSlip}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded px-4 py-2 font-medium"
          >
            Upload Payment Slip
          </button>

          <button
            onClick={() => {
              setPaymentInfo(null);
              setPaymentSlip(null);
            }}
            className="w-full bg-zinc-800 hover:bg-zinc-700 rounded px-4 py-2 text-sm"
          >
            Cancel (Order will be cancelled)
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 space-y-4">
      <h1 className="text-xl font-bold">{t("cart")}</h1>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Items */}
        <div className="md:col-span-2 space-y-3">
          {/* Select all */}
          <div className="flex items-center gap-2 text-sm mb-1">
            <input
              ref={selectAllRef}
              type="checkbox"
              checked={allChecked && items.length > 0}
              onChange={toggleAll}
            />
            <span className="opacity-80">
              Select all{" "}
              <span className="opacity-60">
                ({items.filter((it) => selected[it.id]).length}/{items.length})
              </span>
            </span>
          </div>

          {items.length === 0 ? (
            <div className="text-zinc-400">{t("empty_cart") || "Your cart is empty."}</div>
          ) : (
            items.map((it) => {
              const imgUrl = getCoverImage(it);
              const brief = getVariantBrief(it);
              return (
                <div
                  key={it.id}
                  className="flex items-center gap-3 p-3 rounded border border-zinc-800 bg-zinc-900"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={!!selected[it.id]}
                    onChange={() => toggleItem(it.id)}
                  />

                  {/* Thumbnail */}
                  <div className="w-16 h-16 bg-zinc-800 flex-shrink-0 rounded overflow-hidden">
                    {imgUrl ? (
                      <img 
                        src={imgUrl} 
                        alt={it.product_detail.name_en}
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-[10px] text-zinc-500">
                        no image
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1">
                    <div className="font-semibold text-sm">
                      {it.product_detail.name_en}
                    </div>
                    {brief && (
                      <div className="text-xs text-zinc-400">{brief}</div>
                    )}
                    <div className="text-xs text-zinc-400">
                      {fmt.currency(it.product_detail.sale_price)} ×
                    </div>
                  </div>

                  {/* Qty / Remove */}
                  <input
                    type="number"
                    min={1}
                    value={it.quantity}
                    onChange={(e) => updateQty(it.id, Math.max(1, Number(e.target.value)))}
                    className="w-20 bg-zinc-900 border border-zinc-700 rounded px-2 py-1"
                  />
                  <button
                    onClick={() => removeItem(it.id)}
                    className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700"
                  >
                    Remove
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Summary */}
        <div className="p-4 rounded border border-zinc-800 bg-zinc-900 space-y-3">
          {/* Address selector */}
          <div className="space-y-2">
            <div className="text-sm text-zinc-400">Shipping address</div>
            <select
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
              value={selectedAddressId ?? ""}
              onChange={(e) =>
                setSelectedAddressId(e.target.value ? Number(e.target.value) : null)
              }
            >
              {addresses.length === 0 ? (
                <option value="">No address — please add one in Profile</option>
              ) : (
                addresses.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name} | {a.phone} | {a.address} {a.province} {a.postal_code}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Carrier selector */}
          <div className="space-y-2">
            <div className="text-sm text-zinc-400">Carrier</div>
            <select
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
              value={selectedCarrier}
              onChange={(e) => setSelectedCarrier(e.target.value)}
            >
              <option value="Kerry">Kerry</option>
              <option value="J&T">J&amp;T</option>
              <option value="Flash">Flash</option>
              <option value="DHL">DHL</option>
            </select>
          </div>

          {/* Coupon Section */}
          <div className="space-y-2">
            <div className="text-sm text-zinc-400">Coupon code</div>
            
            {appliedCoupon ? (
              <div className="p-2 bg-emerald-900/20 border border-emerald-700 rounded flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-emerald-400">{appliedCoupon.code}</div>
                  <div className="text-xs text-zinc-400">
                    {appliedCoupon.discount_type === "percent" 
                      ? `${appliedCoupon.percent_off}% discount` 
                      : "Free shipping"}
                    {appliedCoupon.min_spend > 0 && 
                      ` (Min spend: ${fmt.currency(appliedCoupon.min_spend)})`}
                  </div>
                </div>
                <button
                  onClick={removeCoupon}
                  className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value)}
                  placeholder="Enter coupon code"
                  className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm"
                />
                <button
                  onClick={applyCoupon}
                  disabled={!coupon.trim()}
                  className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  Apply
                </button>
              </div>
            )}
          </div>

          {/* Totals */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{fmt.currency(subtotal)}</span>
            </div>
            
            {/* Show discount if applied */}
            {discountAmount > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>Discount ({appliedCoupon?.percent_off}%)</span>
                <span>-{fmt.currency(discountAmount)}</span>
              </div>
            )}
            
            <div className="flex justify-between">
              <span>Shipping</span>
              <span>
                {appliedCoupon?.discount_type === "free_shipping" && subtotal >= (appliedCoupon?.min_spend || 0) ? (
                  <span className="text-emerald-400">
                    <span className="line-through text-zinc-500">{fmt.currency(shipping)}</span> Free
                  </span>
                ) : (
                  fmt.currency(finalShipping)
                )}
              </span>
            </div>
            
            <div className="border-t border-zinc-700 pt-2">
              <div className="flex justify-between font-semibold text-emerald-400 text-lg">
                <span>Total</span>
                <span>{fmt.currency(total)}</span>
              </div>
            </div>
          </div>

          <button
            disabled={placing || chosen.length === 0}
            onClick={checkout}
            className="w-full px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60"
            title={chosen.length === 0 ? "Select at least 1 item" : "Checkout"}
          >
            {placing ? "Processing..." : t("checkout")}
          </button>

          {chosen.length === 0 && items.length > 0 && (
            <p className="text-xs mt-2 text-amber-400">
              กรุณาเลือกสินค้าอย่างน้อย 1 รายการก่อนทำการชำระเงิน
            </p>
          )}
        </div>
      </div>
    </main>
  );
}