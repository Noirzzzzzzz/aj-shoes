export const fmt = {
  currency(n: number | string): string {
    const num = typeof n === "string" ? Number(n) : n;
    return num.toLocaleString("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 });
  },
};
