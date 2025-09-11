import { fmt } from "@/utils/format";

export default function Price({ base, salePercent, salePrice }:{ base:number|string; salePercent:number; salePrice:string|number; }) {
  const b = typeof base === "string" ? Number(base) : base;
  const sp = typeof salePrice === "string" ? Number(salePrice) : salePrice;

  if (salePercent > 0) {
    return (
      <div className="flex items-baseline gap-2">
        <span className="line-through text-zinc-400">{fmt.currency(b)}</span>
        <span className="text-emerald-400 font-semibold">{fmt.currency(sp)}</span>
        <span className="text-xs text-emerald-300">-{salePercent}%</span>
      </div>
    );
  }
  return <div className="text-zinc-100 font-semibold">{fmt.currency(b)}</div>;
}
