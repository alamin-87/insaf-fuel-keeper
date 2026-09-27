import type { Product, StockMovement } from "../types/index.ts";
import { parseRecordTime, type DateRange } from "./date-range.ts";

export type StockLedgerLine = {
  id: string;
  date: string;
  particulars: string;
  qtyIn: number;
  qtyOut: number;
  inHand: number;
  unitCost: number;
  valuation: number;
};

export type ProductStockReport = {
  id: string;
  code: string;
  name: string;
  openingQty: number;
  qtyIn: number;
  qtyOut: number;
  inHand: number;
  unitCost: number;
  valuation: number;
  lines: StockLedgerLine[];
};

export function isMovementIn(m: StockMovement): boolean {
  if (m.direction === "in") return true;
  if (m.direction === "out") return false;
  if (m.movementType) {
    return (
      m.movementType === "RECEIPT" ||
      m.movementType === "RETURN" ||
      m.movementType === "ADJUSTMENT_IN" ||
      m.movementType === "TRANSFER_IN"
    );
  }
  if (m.type === "in" || m.type === "return") return true;
  if (m.type === "out") return false;
  if (m.type === "adjust") {
    return (m.quantity || 0) >= 0;
  }
  return false;
}

export function isMovementOut(m: StockMovement): boolean {
  if (m.direction === "out") return true;
  if (m.direction === "in") return false;
  if (m.movementType) {
    return (
      m.movementType === "SALE_ISSUE" ||
      m.movementType === "ADJUSTMENT_OUT" ||
      m.movementType === "DAMAGE" ||
      m.movementType === "LOSS" ||
      m.movementType === "TRANSFER_OUT"
    );
  }
  if (m.type === "out") return true;
  if (m.type === "in" || m.type === "return") return false;
  if (m.type === "adjust") {
    return (m.quantity || 0) < 0;
  }
  return false;
}

export function getMovementQtyIn(m: StockMovement): number {
  if (isMovementIn(m)) return Math.abs(m.quantity || 0);
  return 0;
}

export function getMovementQtyOut(m: StockMovement): number {
  if (isMovementOut(m)) return Math.abs(m.quantity || 0);
  return 0;
}

function refLabel(m: StockMovement) {
  const bits = [m.notes, m.refType, m.refId].filter(Boolean);
  if (bits.length) return bits[0] as string;
  if (isMovementIn(m)) return "Stock In";
  if (isMovementOut(m)) return "Stock Out";
  return m.type;
}

export function buildStockReport(
  products: Product[],
  movements: StockMovement[],
  range: DateRange,
): ProductStockReport[] {
  const fromTs = range.preset !== "all" && range.from ? parseRecordTime(`${range.from}T00:00:00`) : null;
  const toTs = range.preset !== "all" && range.to ? parseRecordTime(`${range.to}T23:59:59`) : null;

  const byProduct = new Map<string, StockMovement[]>();
  for (const m of movements) {
    const list = byProduct.get(m.productId) ?? [];
    list.push(m);
    byProduct.set(m.productId, list);
  }

  return products
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => {
      const all = (byProduct.get(p.id) ?? []).slice().sort(
        (a, b) => (parseRecordTime(a.date) ?? 0) - (parseRecordTime(b.date) ?? 0),
      );

      let openingQty = 0;
      let effectiveCost = p.cost ?? 0;
      const period: StockMovement[] = [];

      for (const m of all) {
        const t = parseRecordTime(m.date) ?? 0;
        const qIn = getMovementQtyIn(m);
        const qOut = getMovementQtyOut(m);

        if (fromTs != null && t < fromTs) {
          openingQty += qIn - qOut;
          if (m.unitCost != null && m.unitCost > 0) effectiveCost = m.unitCost;
          continue;
        }

        if (toTs != null && t > toTs) {
          continue;
        }

        period.push(m);
      }

      // If no movements exist at all and range is all time, opening is 0, or fallback to p.stock if no movements
      if (all.length === 0 && fromTs == null) {
        openingQty = p.stock ?? 0;
      }

      const lines: StockLedgerLine[] = [];
      let run = openingQty;
      const openingDate = range.from || p.createdAt || new Date().toISOString();

      lines.push({
        id: `${p.id}-open`,
        date: openingDate,
        particulars: "Opening",
        qtyIn: 0,
        qtyOut: 0,
        inHand: openingQty,
        unitCost: effectiveCost,
        valuation: openingQty * effectiveCost,
      });

      let periodIn = 0;
      let periodOut = 0;

      for (const m of period) {
        const qIn = getMovementQtyIn(m);
        const qOut = getMovementQtyOut(m);
        periodIn += qIn;
        periodOut += qOut;
        run = run + qIn - qOut;
        if (m.unitCost != null && m.unitCost > 0) effectiveCost = m.unitCost;

        const lineCost = m.unitCost ?? effectiveCost;
        lines.push({
          id: m.id,
          date: m.date,
          particulars: refLabel(m),
          qtyIn: qIn,
          qtyOut: qOut,
          inHand: run,
          unitCost: lineCost,
          valuation: run * lineCost,
        });
      }

      const inHand = openingQty + periodIn - periodOut;
      const unitCost = p.cost ?? effectiveCost;
      const valuation = inHand * unitCost;

      return {
        id: p.id,
        code: p.code,
        name: p.name,
        openingQty,
        qtyIn: periodIn,
        qtyOut: periodOut,
        inHand,
        unitCost,
        valuation,
        lines,
      };
    });
}
