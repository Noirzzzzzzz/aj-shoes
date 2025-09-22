// src/utils/log.ts — safe logger (no custom headers, no infinite loop)
type Level = "info" | "warn" | "error";
type Payload = { level: Level; message: string; stack?: string; path?: string; ts?: number; meta?: any };

const TTL = 15000;
const seen = new Map<string, number>();
const key = (p: Payload) => `${p.level}:${p.message}:${p.stack?.slice(0,80)}`;

async function send(p: Payload) {
  try {
    const k = key(p), now = Date.now();
    if ((seen.get(k) ?? 0) + TTL > now) return;
    seen.set(k, now);

    const url = "/api/logs/frontend/";
    const body = JSON.stringify(p);

    // ตัด preflight ให้มากที่สุดด้วย sendBeacon (ไม่มี promise = ไม่เกิด unhandledrejection)
    if ("sendBeacon" in navigator) {
      const blob = new Blob([body], { type: "application/json" });
      // @ts-ignore
      if (navigator.sendBeacon(url, blob)) return;
    }

    // ตกลง fetch: ใช้แค่ Content-Type (อยู่ใน allow list แล้ว)
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" }, // ✅ ไม่มี X-Page-Path
      credentials: "include",
      keepalive: true,
      body,
    }).catch(() => {}); // ✅ กลืน error กันวนซ้ำ
  } catch {
    /* no-op */
  }
}

export function logClientError(payload: { message: string; stack?: string; meta?: any }) {
  // กันวนซ้ำตัวเอง: ถ้า error มาจากการยิง /api/logs/frontend/ ก็ไม่ต้อง log
  const msg = payload?.message || "";
  if (msg.includes("/api/logs/frontend")) return;
  send({ level: "error", message: msg, stack: payload.stack, path: location.pathname, ts: Date.now(), meta: payload.meta });
}
