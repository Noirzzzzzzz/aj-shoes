import { useState, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import Protected from "@/components/Protected";
import api from "@/api/client";
import { fmt } from "@/utils/format";

// Types based on your serializers
interface Item {
  id: number;
  quantity: number;
  product_detail: {
    name_en: string;
    sale_price: number;
    images: Array<{
      image_url: string;
      is_cover: boolean;
    }>;
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

// Payment Component
function PaymentRequired({ 
  order, 
  paymentConfig, 
  onPaymentComplete, 
  onCancel 
}: {
  order: Order;
  paymentConfig: PaymentConfig;
  onPaymentComplete: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [paymentSlip, setPaymentSlip] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState("");
  const [isExpired, setIsExpired] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!order || !order.payment_deadline) return;

    const interval = setInterval(() => {
      const now = new Date();
      const deadline = new Date(order.payment_deadline);
      const diff = deadline.getTime() - now.getTime();

      if (diff <= 0) {
        setIsExpired(true);
        setTimeRemaining("00:00");
        clearInterval(interval);
      } else {
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [order]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
      }
      setPaymentSlip(file);
    }
  };

  const uploadPaymentSlip = async () => {
    if (!paymentSlip) {
      alert('Please select a payment slip image');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('payment_slip', paymentSlip);
      
      await api.post(`/api/orders/orders/${order.id}/upload-payment/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      alert('Payment slip uploaded successfully! Please wait for admin verification.');
      onPaymentComplete();
    } catch (error: any) {
      console.error('Upload error:', error);
      const msg = error?.response?.data?.detail || 'Failed to upload payment slip. Please try again.';
      alert(msg);
    } finally {
      setUploading(false);
    }
  };

  const cancelOrder = async () => {
    if (!confirm('Are you sure you want to cancel this order? Items will be restored to your cart.')) {
      return;
    }

    try {
      const response = await api.post(`/api/orders/orders/${order.id}/cancel/`);
      
      // ปิดหน้าต่าง payment modal ทันที
      onCancel();
      
      // แสดงข้อความสำเร็จ
      alert('Order cancelled successfully. Items restored to cart.');
      
    } catch (error: any) {
      console.error('Cancel error:', error);
      
      // ถึงแม้จะ error ก็ปิดหน้าต่างไปเลย เพราะ order อาจถูกลบแล้ว
      onCancel();
      
      // แสดงข้อความที่เป็นมิตรกว่า
      alert('Order cancellation processed. Please check your cart.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-900 rounded-lg p-8 max-w-md w-full border border-zinc-800 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-white mb-2">Payment Required</h1>
          <div className="text-emerald-400 text-2xl font-bold">
            {t('total')}: {fmt.currency(order.total)}
          </div>
          <div className="text-sm text-zinc-400 mt-2">
            Order expires: {new Date(order.payment_deadline).toLocaleString()}
          </div>
        </div>

        {/* QR Code */}
        <div className="bg-white rounded-lg p-2 mb-6">
          <div className="flex justify-center">
            <img 
              src={paymentConfig.qr_code_url} 
              alt="Payment QR Code"
              className="w-full h-auto max-w-sm rounded"
            />
          </div>
        </div>

        {/* Payment Details */}
        <div className="space-y-3 mb-6 text-sm">
          <div className="flex justify-between">
            <span className="text-zinc-400">{t('bank')}:</span>
            <span className="text-white">{paymentConfig.bank_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">{t('account')}:</span>
            <span className="text-white">{paymentConfig.account_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">{t('number')}:</span>
            <span className="text-white">{paymentConfig.account_number}</span>
          </div>
        </div>

        {/* Timer */}
        <div className="text-center mb-6">
          <div className={`text-lg font-mono ${isExpired ? 'text-red-500' : 'text-yellow-400'}`}>
            Time remaining: {timeRemaining}
          </div>
          {isExpired && (
            <div className="text-red-400 text-sm mt-1">
              Payment deadline expired
            </div>
          )}
        </div>

        {/* File Upload */}
        <div className="mb-6">
          <label className="block text-sm text-zinc-400 mb-2">
            Upload Payment Slip:
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-emerald-600 file:text-white"
          />
          {paymentSlip && (
            <div className="text-sm text-green-400 mt-1">
              Selected: {paymentSlip.name}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={uploadPaymentSlip}
            disabled={uploading || isExpired || !paymentSlip}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:opacity-50 text-white font-medium py-3 rounded transition-colors"
          >
            {uploading ? 'Uploading...' : t('upload_payment_slip')}
          </button>
          
          <button
            onClick={cancelOrder}
            disabled={uploading}
            className="w-full bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white py-3 rounded transition-colors"
          >
            {t('cancel_order')} (Order will be cancelled)
          </button>
        </div>

        {/* Warning message */}
        {isExpired && (
          <div className="mt-4 p-3 bg-red-900/30 border border-red-700 rounded text-red-400 text-sm">
            Payment deadline has expired. Please cancel this order and place a new one.
          </div>
        )}
      </div>
    </div>
  );
}

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
  const [coupon, setCoupon] = useState("");
  const [shipping, setShipping] = useState(50);

  // selection
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  // totals
  const chosen = useMemo(() => items.filter((it) => selected[it.id]), [items, selected]);
  const subtotal = useMemo(
    () => chosen.reduce((acc, it) => acc + Number(it.product_detail.sale_price) * it.quantity, 0),
    [chosen]
  );
  const total = useMemo(() => subtotal + (chosen.length > 0 ? shipping : 0), [subtotal, shipping, chosen.length]);

  // address + carrier + placing
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [selectedCarrier, setSelectedCarrier] = useState<string>("Kerry");
  const [placing, setPlacing] = useState(false);

  // payment state
  const [showPayment, setShowPayment] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);

  // ---------- helpers ----------
  const getCoverImage = (it: Item) => {
    console.log("Debug product_detail:", it.product_detail);
    
    const pd = it.product_detail;
    if (!pd || !pd.images) {
      console.log("No product_detail or images found");
      return "";
    }

    const images = pd.images;
    console.log("Images array:", images);
    
    if (!Array.isArray(images) || images.length === 0) {
      console.log("Images is not array or empty");
      return "";
    }

    // หารูป cover ก่อน ถ้าไม่มีใช้รูปแรก
    const coverImage = images.find(img => img.is_cover) || images[0];
    console.log("Selected image:", coverImage);
    
    if (!coverImage) {
      return "";
    }

    // ลองหา URL จากหลายฟิลด์ที่เป็นไปได้
    const imageUrl = coverImage.image_url;
    console.log("Final image URL:", imageUrl);
    
    return imageUrl || "";
  };

  // สร้างข้อความรายละเอียด variant สั้นๆ เช่น "Black • EU 42"
  const getVariantBrief = (it: Item) => {
    const v = it.variant_detail || {};
    const color =
      (v.color_label as string) ||
      (v.color_name as string) ||
      (v.color as string) ||
      "";

    // เลือกไซส์แบบที่มีค่า
    const sizeRaw =
      v.size_label ??
      v.size ??
      v.size_eu ??
      v.size_us ??
      v.size_cm ??
      "";

    const size =
      sizeRaw !== "" && sizeRaw !== undefined ? ` ${String(sizeRaw)}` : "";

    const parts: string[] = [];
    if (color) parts.push(color);
    if (size.trim()) {
      // ใส่ prefix ถ้าระบุชนิดได้จาก key
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
      console.log("Cart data received:", data);
      const list: Item[] = data.items || [];
      console.log("Cart items:", list);
      setItems(list);
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
    console.log("🚀 useEffect triggered - loading cart and addresses");
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
    await api.post("/api/orders/cart/apply-coupon/", { code: coupon });
    setCoupon("");
    await loadCart();
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
    try {
      setPlacing(true);
      const payload = {
        address_id: selectedAddressId,
        carrier: selectedCarrier || "Kerry",
        cart_item_ids: chosen.map((c) => c.id), // ✅ ส่งเฉพาะที่เลือก
      };
      const response = await api.post("/api/orders/cart/checkout/", payload);
      
      if (response.data.requires_payment) {
        // Show payment modal
        setPaymentOrder(response.data.order);
        setPaymentConfig(response.data.payment_config);
        setShowPayment(true);
      } else {
        // Old flow - redirect to orders (shouldn't happen with new system)
        alert("Order placed successfully!");
        setItems([]);
        setCoupon("");
        setSelected({});
        window.location.href = "/orders";
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        (typeof err?.response?.data === "string" && err.response.data) ||
        "Checkout failed. Please try again.";
      alert(msg);
      console.error("checkout error", err?.response || err);
    } finally {
      setPlacing(false);
    }
  }

  const handlePaymentComplete = () => {
    setShowPayment(false);
    setPaymentOrder(null);
    setPaymentConfig(null);
    // Clear cart and redirect
    setItems([]);
    setCoupon("");
    setSelected({});
    window.location.href = "/orders";
  };

  const handlePaymentCancel = () => {
    setShowPayment(false);
    setPaymentOrder(null);
    setPaymentConfig(null);
    // Reload cart to show restored items
    loadCart();
  };

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
                    {/* รายละเอียดตัวเลือกที่ลูกค้าเลือกทึ่เลือก */}
                    {brief && (
                      <div className="text-xs text-zinc-400">{brief}</div>
                    )}
                    {/* ราคาต่อชิ้น */}
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

          {/* Coupon */}
          <div className="flex gap-2">
            <input
              value={coupon}
              onChange={(e) => setCoupon(e.target.value)}
              placeholder={t("coupon_code") || "Coupon code"}
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1"
            />
            <button
              onClick={applyCoupon}
              className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700"
            >
              {t("apply")}
            </button>
          </div>

          {/* Totals */}
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{fmt.currency(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Shipping</span>
            <span>{fmt.currency(chosen.length > 0 ? shipping : 0)}</span>
          </div>
          <div className="flex justify-between font-semibold text-emerald-400">
            <span>Total</span>
            <span>{fmt.currency(total)}</span>
          </div>

          <button
            disabled={placing || chosen.length === 0}
            onClick={checkout}
            className="w-full px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60"
            title={chosen.length === 0 ? "Select at least 1 item" : "Checkout"}
          >
            {placing ? "Placing..." : t("checkout")}
          </button>

          {chosen.length === 0 && items.length > 0 && (
            <p className="text-xs mt-2 text-amber-400">
              กรุณาเลือกสินค้าอย่างน้อย 1 รายการก่อนทำการชำระเงิน
            </p>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {showPayment && paymentOrder && paymentConfig && (
        <PaymentRequired
          order={paymentOrder}
          paymentConfig={paymentConfig}
          onPaymentComplete={handlePaymentComplete}
          onCancel={handlePaymentCancel}
        />
      )}
    </main>
  );
}