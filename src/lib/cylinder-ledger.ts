import type { Customer, Cylinder, CylinderMovement, Product, Supplier } from "@/types";
import { parseRecordTime, type DateRange } from "@/lib/date-range";

export type CylinderHeadKind = "customer" | "supplier" | "warehouse";

export type CylinderLedgerLine = {
  id: string;
  date: string;
  productName: string;
  serial?: string;
  delivered: number;
  received: number;
  balance: number;
};

export type CylinderHeadReport = {
  id: string;
  kind: CylinderHeadKind;
  name: string;
  delivered: number;
  received: number;
  balance: number;
  lines: CylinderLedgerLine[];
};

type RawHit = {
  date: string;
  productName: string;
  serial?: string;
  delivered: number;
  received: number;
  sort: number;
  key: string;
};

const SUPPLIER_LOC = /supplier|plant|bashundhara|linde|omera|refill/i;
const WAREHOUSE_LOC = /warehouse|gudam|\bwh\b/i;

function productNameOf(cyl: Cylinder | undefined, products: Product[]) {
  if (!cyl) return "Cylinder";
  return products.find((p) => p.id === cyl.productId)?.name ?? cyl.serialNumber;
}

function matchByName<T extends { id: string; name: string }>(
  loc: string | undefined,
  parties: T[],
): T | undefined {
  const n = (loc || "").trim().toLowerCase();
  if (!n) return undefined;
  return parties.find((p) => {
    const pn = p.name.toLowerCase();
    if (n === pn || n.includes(pn) || pn.includes(n)) return true;
    return pn
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3)
      .some((w) => n.includes(w));
  });
}

function warehouseName(loc?: string) {
  const name = (loc || "").trim();
  if (!name) return "";
  if (SUPPLIER_LOC.test(name)) return "";
  if (WAREHOUSE_LOC.test(name) || name.toLowerCase() === "warehouse") return name;
  return "";
}

/** Party heads: still with them. Warehouse: in hand. */
function applyDelta(kind: CylinderHeadKind, delivered: number, received: number) {
  return kind === "warehouse" ? received - delivered : delivered - received;
}

export function buildCylinderLedger(opts: {
  cylinders: Cylinder[];
  movements: CylinderMovement[];
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  range: DateRange;
  productId?: string;
}): CylinderHeadReport[] {
  const { cylinders, movements, products, customers, suppliers, range, productId } = opts;
  const cylMap = new Map(cylinders.map((c) => [c.id, c]));
  const fromTs = range.preset !== "all" && range.from ? parseRecordTime(range.from) : null;
  const toTs = range.preset !== "all" && range.to ? parseRecordTime(`${range.to}T23:59:59`) : null;

  const buckets = new Map<string, { kind: CylinderHeadKind; name: string; hits: RawHit[] }>();

  const ensure = (id: string, kind: CylinderHeadKind, name: string) => {
    if (!buckets.has(id)) buckets.set(id, { kind, name, hits: [] });
    return buckets.get(id)!;
  };

  const push = (
    id: string,
    kind: CylinderHeadKind,
    name: string,
    m: CylinderMovement,
    delivered: number,
    received: number,
  ) => {
    if (!id || (!delivered && !received)) return;
    const cyl = cylMap.get(m.cylinderId);
    if (productId && cyl?.productId !== productId) return;
    ensure(id, kind, name).hits.push({
      date: m.timestamp,
      productName: productNameOf(cyl, products),
      serial: cyl?.serialNumber,
      delivered,
      received,
      sort: parseRecordTime(m.timestamp) ?? 0,
      key: `${m.id}:${id}:${delivered}:${received}`,
    });
  };

  const sorted = movements
    .slice()
    .sort((a, b) => (parseRecordTime(a.timestamp) ?? 0) - (parseRecordTime(b.timestamp) ?? 0));

  for (const m of sorted) {
    const cust =
      (m.customerId ? customers.find((c) => c.id === m.customerId) : undefined) ||
      matchByName(m.toLocation, customers) ||
      matchByName(m.fromLocation, customers);
    const supp =
      (m.supplierId ? suppliers.find((s) => s.id === m.supplierId) : undefined) ||
      matchByName(m.fromLocation, suppliers) ||
      matchByName(m.toLocation, suppliers);
    const fromWh = warehouseName(m.fromLocation);
    const toWh = warehouseName(m.toLocation);

    if (m.type === "issued") {
      if (cust) push(`c:${cust.id}`, "customer", cust.name, m, 1, 0);
      if (fromWh) push(`wh:${fromWh}`, "warehouse", fromWh, m, 1, 0);
      else if (!m.fromLocation) push("wh:Warehouse", "warehouse", "Warehouse", m, 1, 0);
    } else if (m.type === "returned") {
      if (cust) push(`c:${cust.id}`, "customer", cust.name, m, 0, 1);
      if (toWh) push(`wh:${toWh}`, "warehouse", toWh, m, 0, 1);
      if (supp) push(`s:${supp.id}`, "supplier", supp.name, m, 1, 0);
    } else if (m.type === "received") {
      if (supp) push(`s:${supp.id}`, "supplier", supp.name, m, 0, 1);
      if (toWh) push(`wh:${toWh}`, "warehouse", toWh, m, 0, 1);
      else push("wh:Warehouse", "warehouse", "Warehouse", m, 0, 1);
    } else if (m.type === "refilled" || m.type === "transferred") {
      if (fromWh) push(`wh:${fromWh}`, "warehouse", fromWh, m, 1, 0);
      if (toWh) push(`wh:${toWh}`, "warehouse", toWh, m, 0, 1);
      if (supp && SUPPLIER_LOC.test(m.toLocation || ""))
        push(`s:${supp.id}`, "supplier", supp.name, m, 1, 0);
      if (supp && SUPPLIER_LOC.test(m.fromLocation || ""))
        push(`s:${supp.id}`, "supplier", supp.name, m, 0, 1);
    }
  }

  for (const cyl of cylinders) {
    const hasMv = movements.some((m) => m.cylinderId === cyl.id);
    if (hasMv) continue;
    const fake: CylinderMovement = {
      id: `snap-${cyl.id}`,
      cylinderId: cyl.id,
      type: cyl.status === "at_customer" ? "issued" : "received",
      timestamp: cyl.lastMovementAt || cyl.createdAt,
      by: "System",
      customerId: cyl.customerId,
      toLocation: cyl.location,
      fromLocation: cyl.location,
    };
    if (cyl.status === "at_customer" && cyl.customerId) {
      const cust = customers.find((c) => c.id === cyl.customerId);
      push(`c:${cyl.customerId}`, "customer", cust?.name || cyl.location, fake, 1, 0);
    } else if (cyl.status === "in_stock") {
      const wh = warehouseName(cyl.location) || cyl.location || "Warehouse";
      push(`wh:${wh}`, "warehouse", wh, fake, 0, 1);
    } else if (SUPPLIER_LOC.test(cyl.location || "")) {
      const supp = matchByName(cyl.location, suppliers);
      if (supp) push(`s:${supp.id}`, "supplier", supp.name, fake, 1, 0);
      else push(`suploc:${cyl.location}`, "supplier", cyl.location, fake, 1, 0);
    }
  }

  const kindOrder: CylinderHeadKind[] = ["warehouse", "customer", "supplier"];
  const reports: CylinderHeadReport[] = [];

  for (const [id, bucket] of buckets) {
    bucket.hits.sort((a, b) => a.sort - b.sort);
    let opening = 0;
    const period: RawHit[] = [];
    for (const h of bucket.hits) {
      const t = h.sort;
      if (fromTs != null && t < fromTs) {
        opening += applyDelta(bucket.kind, h.delivered, h.received);
        continue;
      }
      if (toTs != null && t > toTs) continue;
      period.push(h);
    }

    const lines: CylinderLedgerLine[] = [];
    let run = opening;
    lines.push({
      id: `${id}-open`,
      date: range.from || bucket.hits[0]?.date || new Date().toISOString(),
      productName: "Opening",
      delivered: 0,
      received: 0,
      balance: opening,
    });

    let del = 0;
    let rec = 0;
    for (const h of period) {
      del += h.delivered;
      rec += h.received;
      run += applyDelta(bucket.kind, h.delivered, h.received);
      lines.push({
        id: h.key,
        date: h.date,
        productName: h.productName,
        serial: h.serial,
        delivered: h.delivered,
        received: h.received,
        balance: run,
      });
    }

    reports.push({
      id,
      kind: bucket.kind,
      name: bucket.name,
      delivered: del,
      received: rec,
      balance: run,
      lines,
    });
  }

  reports.sort((a, b) => {
    const ko = kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind);
    if (ko !== 0) return ko;
    return a.name.localeCompare(b.name);
  });

  return reports;
}
