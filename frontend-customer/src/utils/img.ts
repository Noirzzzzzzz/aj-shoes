export function optImg(url?: string, opts?: { w?: number; h?: number; fit?: "cover"|"thumb"; q?: number }){
  if (!url) return "";
  const u = new URL((import.meta.env.VITE_API_BASE || "http://localhost:8000") + "/img/opt/");
  u.searchParams.set("url", url);
  if (opts?.w) u.searchParams.set("w", String(opts.w));
  if (opts?.h) u.searchParams.set("h", String(opts.h));
  if (opts?.fit) u.searchParams.set("fit", opts.fit);
  if (opts?.q) u.searchParams.set("q", String(opts.q));
  return u.toString();
}
