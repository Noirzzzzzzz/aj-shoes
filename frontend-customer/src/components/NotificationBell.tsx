import { useCallback, useEffect, useState } from "react";
import { useNotificationsWS } from "@/hooks/useNotificationsWS";
import { FaBell, FaTimes } from "react-icons/fa";

type Noti = { 
  id: number; 
  title: string; 
  message?: string; 
  data?: any; 
  kind: string; 
  created_at: string; 
  is_read?: boolean 
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function buildHeaders(extra: Record<string, string> = {}) {
  const base: Record<string, string> = { 
    "Accept": "application/json", 
    "Content-Type": "application/json",
    ...extra 
  };
  
  // ใช้ authentication method เดียวกัน - เลือกระหว่าง token หรือ cookies
  const token = localStorage.getItem("access");
  if (token) {
    base["Authorization"] = `Bearer ${token}`;
  }
  
  return base;
}

async function safeJson(res: Response) {
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = await res.text();
    throw new Error(`Expected JSON, got: ${ct}. Response: ${text.slice(0, 120)}...`);
  }
  return res.json();
}

async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const url = API_BASE ? `${API_BASE}${endpoint}` : endpoint;
  
  const defaultOptions: RequestInit = {
    credentials: "include",
    headers: buildHeaders(),
  };
  
  const finalOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...(options.headers || {})
    }
  };
  
  const response = await fetch(url, finalOptions);
  return safeJson(response);
}

export default function NotificationBell() {
  const [unread, setUnread] = useState<number>(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Noti[]>([]);
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  // โหลด unread count ตอนเริ่มต้น
  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const list: Noti[] = await apiRequest("/api/notifications/?unread=true");
        setUnread(list.length);
      } catch (err) {
        console.warn("Failed to fetch unread notifications:", err);
      }
    };
    
    fetchUnread();
  }, []);

  const onMessage = useCallback((payload: any) => {
    console.log("Notification received:", payload);
    
    const notificationId = payload.id || payload.notification_id;
    if (notificationId) {
      const recentNotifications = JSON.parse(localStorage.getItem('recent_notifications') || '[]');
      
      const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
      const filteredRecent = recentNotifications.filter((item: any) => 
        item.timestamp > fiveMinutesAgo
      );
      
      if (filteredRecent.some((item: any) => item.id === notificationId)) {
        console.log("Duplicate notification ignored:", notificationId);
        return;
      }
      
      filteredRecent.push({ id: notificationId, timestamp: Date.now() });
      localStorage.setItem('recent_notifications', JSON.stringify(filteredRecent.slice(-50)));
    }
    
    setUnread((n) => n + 1);
    setItems((prev) => [payload as Noti, ...prev].slice(0, 30));
  }, []);

  useNotificationsWS(onMessage);

  const toggle = async () => {
    const willOpen = !open;
    setOpen(willOpen);
    
    if (willOpen) {
      setLoading(true);
      try {
        // โหลดรายการ notifications
        const list: Noti[] = await apiRequest("/api/notifications/");
        setItems(list);

        // mark all as read
        await apiRequest("/api/notifications/mark-all-read/", {
          method: "POST",
          body: JSON.stringify({})
        });
        
        setUnread(0);
      } catch (err) {
        console.error("Failed to load notifications:", err);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleOpen = (n: Noti) => {
    // ปิด dropdown ก่อน
    setOpen(false);
    
    // นำทางไปยังหน้าที่เกี่ยวข้อง
    if (n.kind === "order" && n.data?.order_id) {
      window.location.href = `/orders/${n.data.order_id}`;
    } else if (n.kind === "chat") {
      window.location.href = `/chat`;
    } else if (n.kind === "coupon") {
      window.location.href = `/coupons`;
    }
  };

  const deleteAllNotifications = async () => {
    if (!confirm('คุณต้องการลบการแจ้งเตือนทั้งหมดหรือไม่?')) return;
    
    setLoading(true);
    try {
      await apiRequest("/api/notifications/", {
        method: "DELETE"
      });
      setItems([]);
      setUnread(0);
    } catch (err) {
      console.error("Failed to delete all notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  const deleteNotification = async (id: number) => {
    setDeletingIds(prev => new Set([...prev, id]));
    try {
      await apiRequest(`/api/notifications/${id}/`, {
        method: "DELETE"
      });
      setItems(prev => prev.filter(item => item.id !== id));
      if (!open) setUnread(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to delete notification:", err);
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={toggle} 
        className="relative rounded-2xl p-2 hover:bg-neutral-800 transition-colors" 
        aria-label="การแจ้งเตือน"
        disabled={loading}
      >
        <FaBell className="text-lg" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 text-xs px-1.5 py-0.5 bg-red-600 text-white rounded-full min-w-[20px] text-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 max-h-[70vh] overflow-auto rounded-2xl bg-neutral-900 shadow-xl border border-neutral-800 z-50">
          <div className="px-4 py-3 text-sm font-medium border-b border-neutral-800 flex items-center justify-between">
            <span>การแจ้งเตือน</span>
            <div className="flex items-center space-x-2">
              {loading && (
                <div className="w-4 h-4 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
              )}
              {items.length > 0 && (
                <button
                  onClick={deleteAllNotifications}
                  disabled={loading}
                  className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
                >
                  ลบทั้งหมด
                </button>
              )}
            </div>
          </div>
          
          <div className="divide-y divide-neutral-800 max-h-96 overflow-y-auto">
            {items.length === 0 && !loading && (
              <div className="p-4 text-sm text-neutral-400 text-center">
                ยังไม่มีการแจ้งเตือน
              </div>
            )}
            
            {items.map((it) => (
              <div 
                key={it.id} 
                className="p-3 hover:bg-neutral-800 transition-colors border-b border-neutral-800 last:border-b-0 group"
              >
                <div className="flex items-start justify-between">
                  <div 
                    className="flex-1 cursor-pointer"
                    onClick={() => handleOpen(it)}
                  >
                    <div className="text-sm font-medium text-white">
                      {it.title}
                    </div>
                    {it.message && (
                      <div className="text-xs text-neutral-400 mt-1">
                        {it.message}
                      </div>
                    )}
                    <div className="text-[11px] text-neutral-500 mt-2">
                      {new Date(it.created_at).toLocaleString('th-TH')}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-2">
                    {!it.is_read && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                    )}
                    
                    {/* ปุ่มลบ */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(it.id);
                      }}
                      disabled={deletingIds.has(it.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-600 rounded-full transition-all duration-200 disabled:opacity-50"
                      title="ลบการแจ้งเตือน"
                    >
                      {deletingIds.has(it.id) ? (
                        <div className="w-3 h-3 border border-neutral-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <FaTimes className="w-3 h-3 text-neutral-400 hover:text-white" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Backdrop ข้างใน dropdown แทน */}
          <div 
            className="fixed inset-0 z-[-1]" 
            onClick={() => {
              console.log("Backdrop clicked");
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}