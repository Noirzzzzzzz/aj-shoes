// src/pages/NotificationSettings.tsx
import { useEffect, useState } from "react";

type Pref = {
  in_app_enabled: boolean;
  web_push_enabled: boolean;
  email_digest_enabled: boolean;
  order_enabled: boolean;
  chat_enabled: boolean;
  coupon_enabled: boolean;
  system_enabled: boolean;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function buildHeaders() {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json"
  };
  
  const token = localStorage.getItem("access");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  return headers;
}

async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const url = API_BASE ? `${API_BASE}${endpoint}` : endpoint;
  
  const defaultHeaders = buildHeaders();
  const finalHeaders = {
    ...defaultHeaders,
    ...(options.headers || {})
  };
  
  const response = await fetch(url, {
    credentials: "include",
    ...options,
    headers: finalHeaders
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

export default function NotificationSettings() {
  const [pref, setPref] = useState<Pref | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await apiRequest("/api/notifications/prefs/");
        setPref(data);
      } catch (err) {
        console.error("Failed to fetch notification preferences:", err);
        setError("ไม่สามารถโหลดการตั้งค่าได้");
      } finally {
        setLoading(false);
      }
    };

    fetchPreferences();
  }, []);

  const update = async (patch: Partial<Pref>) => {
    if (!pref) return;
    
    const next = { ...pref, ...patch };
    
    // Optimistic update
    setPref(next);
    
    try {
      setSaving(true);
      setError(null);
      
      await apiRequest("/api/notifications/prefs/", {
        method: "PUT",
        body: JSON.stringify(next)
      });
    } catch (err) {
      console.error("Failed to update preferences:", err);
      // Revert on error
      setPref(pref);
      setError("ไม่สามารถบันทึกการตั้งค่าได้");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <div className="animate-pulse">
          <div className="h-6 bg-neutral-700 rounded w-32 mb-4"></div>
          <div className="space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="rounded-2xl border border-neutral-800">
                <div className="h-10 bg-neutral-800 border-b border-neutral-800"></div>
                <div className="p-3 space-y-3">
                  {[1, 2, 3].map(j => (
                    <div key={j} className="h-6 bg-neutral-700 rounded"></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!pref) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <div className="text-center py-8">
          <div className="text-red-400 mb-2">เกิดข้อผิดพลาด</div>
          <div className="text-neutral-400 text-sm">ไม่สามารถโหลดการตั้งค่าได้</div>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            ลองใหม่
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-xl font-semibold mb-4">การแจ้งเตือน</h1>
      
      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}
      
      <Section title="ช่องทาง">
        <Toggle 
          label="In-App (แสดงในเว็บ)" 
          value={pref.in_app_enabled} 
          onChange={v => update({ in_app_enabled: v })}
          disabled={saving}
        />
        <Toggle 
          label="Web Push" 
          value={pref.web_push_enabled} 
          onChange={v => update({ web_push_enabled: v })}
          disabled={saving}
        />
        <Toggle 
          label="อีเมลสรุปรายวัน" 
          value={pref.email_digest_enabled} 
          onChange={v => update({ email_digest_enabled: v })}
          disabled={saving}
        />
      </Section>
      
      <Section title="ประเภท">
        <Toggle 
          label="คำสั่งหมายเลข" 
          value={pref.order_enabled} 
          onChange={v => update({ order_enabled: v })}
          disabled={saving}
        />
        <Toggle 
          label="แชท" 
          value={pref.chat_enabled} 
          onChange={v => update({ chat_enabled: v })}
          disabled={saving}
        />
        <Toggle 
          label="คูปอง/โปรโมชัน" 
          value={pref.coupon_enabled} 
          onChange={v => update({ coupon_enabled: v })}
          disabled={saving}
        />
        <Toggle 
          label="ระบบ" 
          value={pref.system_enabled} 
          onChange={v => update({ system_enabled: v })}
          disabled={saving}
        />
      </Section>
      
      {saving && (
        <div className="mt-4 text-center text-sm text-neutral-400">
          กำลังบันทึก...
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string, children: any }) {
  return (
    <div className="rounded-2xl border border-neutral-800 mb-4">
      <div className="px-4 py-2 border-b border-neutral-800 font-medium">
        {title}
      </div>
      <div className="p-3 space-y-2">
        {children}
      </div>
    </div>
  );
}

function Toggle({ 
  label, 
  value, 
  onChange, 
  disabled = false 
}: { 
  label: string; 
  value: boolean; 
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-center justify-between ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <span>{label}</span>
      <input 
        type="checkbox" 
        checked={value} 
        onChange={e => onChange(e.target.checked)}
        disabled={disabled}
        className="w-4 h-4"
      />
    </label>
  );
}