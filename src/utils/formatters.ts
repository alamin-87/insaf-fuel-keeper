const BDT = "৳";
export const formatCurrency = (n: number) =>
  `${BDT}${new Intl.NumberFormat("en-BD", { maximumFractionDigits: 0 }).format(Math.round(n || 0))}`;

export const formatNumber = (n: number) =>
  new Intl.NumberFormat("en-BD").format(n);

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
