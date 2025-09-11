import api from "@/api";
export function logClientError(payload: { message: string; stack?: string }){
  try { api.post("/api/logs/frontend/", payload, { headers: { "X-Page-Path": location.pathname } }); } catch {}
}
window.addEventListener("error", (e)=>{
  const msg = e?.error?.message || e.message || "window.error";
  const stack = e?.error?.stack || "";
  logClientError({ message: msg, stack });
});
window.addEventListener("unhandledrejection", (e:any)=>{
  const reason = e?.reason;
  const msg = typeof reason === "string" ? reason : (reason?.message || "unhandledrejection");
  const stack = reason?.stack || "";
  logClientError({ message: msg, stack });
});
