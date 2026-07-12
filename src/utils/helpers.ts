import type { LineItem } from "@/types";

export const computeTotals = (items: LineItem[]) => {
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const tax = items.reduce((s, i) => s + (i.price * i.quantity * i.taxRate) / 100, 0);
  return { subtotal, tax, total: subtotal + tax };
};

export const genOrderNo = (prefix = "SO") => {
  const y = new Date().getFullYear();
  const n = Math.floor(Math.random() * 9000 + 1000);
  return `${prefix}-${y}-${n}`;
};
