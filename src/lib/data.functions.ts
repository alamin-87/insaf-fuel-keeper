import { createServerFn } from "@tanstack/react-start";
import { getDb } from "./mongo.server";
import { allSeed } from "./seed-data";
import { requireUser } from "./session.server";
import type {
  Customer, Supplier, Product, SalesOrder, DashboardStats, StockAlert,
  Expense, LedgerEntry,
} from "@/types";

type CollName =
  | "customers" | "suppliers" | "products" | "cylinders" | "movements"
  | "sales" | "deliveries" | "expenses" | "ledger";

// Strip Mongo's _id so returned docs are plain and serializable.
const clean = <T,>(doc: any): T => {
  if (!doc) return doc;
  const { _id, ...rest } = doc;
  return rest as T;
};

let seedPromise: Promise<void> | null = null;
async function ensureSeeded() {
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    const db = await getDb();
    const collections = Object.keys(allSeed) as CollName[];
    for (const name of collections) {
      const coll = db.collection(name);
      // Unique index on business `id` prevents duplicate seed rows across races.
      try { await coll.createIndex({ id: 1 }, { unique: true }); } catch {}
      const count = await coll.estimatedDocumentCount();
      if (count === 0) {
        const docs = (allSeed as any)[name] as any[];
        if (docs.length > 0) {
          try { await coll.insertMany(docs.map((d) => ({ ...d })), { ordered: false }); } catch {}
        }
      }
    }
  })().catch((e) => { seedPromise = null; throw e; });
  return seedPromise;
}

async function collAll<T>(name: CollName): Promise<T[]> {
  const db = await getDb();
  await ensureSeeded();
  const docs = await db.collection(name).find({}).sort({ createdAt: -1 }).toArray();
  return docs.map((d) => clean<T>(d));
}

async function collGet<T>(name: CollName, id: string): Promise<T | null> {
  const db = await getDb();
  await ensureSeeded();
  const doc = await db.collection(name).findOne({ id });
  return doc ? clean<T>(doc) : null;
}

async function collCreate<T extends { id?: string }>(name: CollName, data: any): Promise<T> {
  const db = await getDb();
  await ensureSeeded();
  const id = data.id ?? Math.random().toString(36).slice(2, 10);
  const doc = { ...data, id };
  await db.collection(name).insertOne(doc);
  return clean<T>(doc);
}

async function collUpdate<T>(name: CollName, id: string, patch: any): Promise<T> {
  const db = await getDb();
  await ensureSeeded();
  const { _id, id: _ignore, ...rest } = patch;
  await db.collection(name).updateOne({ id }, { $set: rest });
  const doc = await db.collection(name).findOne({ id });
  return clean<T>(doc);
}

async function collRemove(name: CollName, id: string): Promise<void> {
  const db = await getDb();
  await ensureSeeded();
  await db.collection(name).deleteOne({ id });
}

// ---------- Generic CRUD server functions ----------
type CrudInput = { op: "list" | "get" | "create" | "update" | "remove"; coll: CollName; id?: string; data?: any };

export const crudFn = createServerFn({ method: "POST" })
  .inputValidator((d: CrudInput) => d)
  .handler(async ({ data }): Promise<any> => {
    await requireUser();
    switch (data.op) {
      case "list": return await collAll(data.coll);
      case "get": return await collGet(data.coll, data.id!);
      case "create": return await collCreate(data.coll, data.data);
      case "update": return await collUpdate(data.coll, data.id!, data.data);
      case "remove": await collRemove(data.coll, data.id!); return { ok: true };
      default: return null;
    }
  });

function dhakaDay(d: Date) {
  const shifted = new Date(d.getTime() + 6 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

function balanceFor(ledger: LedgerEntry[], account: "cash" | "bank") {
  return ledger
    .filter((e) => e.account === account)
    .reduce((a, e) => a + (e.direction === "in" ? e.amount : -e.amount), 0);
}

// ---------- Dashboard aggregation ----------
export const dashboardFn = createServerFn({ method: "GET" }).handler(async (): Promise<DashboardStats & { stockAlerts: StockAlert[] }> => {
  await requireUser();
  const db = await getDb();
  await ensureSeeded();

  const sales = (await db.collection("sales").find({}).toArray()) as unknown as SalesOrder[];
  const products = (await db.collection("products").find({}).toArray()) as unknown as Product[];
  const suppliers = (await db.collection("suppliers").find({}).toArray()) as unknown as Supplier[];
  const customers = (await db.collection("customers").find({}).toArray()) as unknown as Customer[];
  const expenses = (await db.collection("expenses").find({}).toArray()) as unknown as Expense[];
  const ledger = (await db.collection("ledger").find({}).toArray()) as unknown as LedgerEntry[];

  const todayStr = dhakaDay(new Date());
  let todaysOrders = sales.filter((s) => s.date && dhakaDay(new Date(s.date)) === todayStr);
  // Fallback: if seed data predates today in Dhaka time, use the most recent
  // Dhaka-local sales date so the dashboard is never empty.
  if (todaysOrders.length === 0) {
    const dhakaDates = sales
      .map((s) => (s.date ? dhakaDay(new Date(s.date)) : ""))
      .filter(Boolean)
      .sort();
    const fallback = dhakaDates[dhakaDates.length - 1];
    if (fallback) {
      todaysOrders = sales.filter((s) => s.date && dhakaDay(new Date(s.date)) === fallback);
    }
  }

  const todaySales = todaysOrders.reduce((a, o) => a + (o.total || 0), 0);
  const todayCollection = todaysOrders.reduce((a, o) => a + (o.paid || 0), 0);

  let todaysExpenses = expenses.filter((e) => e.date && dhakaDay(new Date(e.date)) === todayStr);
  if (todaysExpenses.length === 0) {
    const expenseDates = expenses
      .map((e) => (e.date ? dhakaDay(new Date(e.date)) : ""))
      .filter(Boolean)
      .sort();
    const fallback = expenseDates[expenseDates.length - 1];
    if (fallback) {
      todaysExpenses = expenses.filter((e) => e.date && dhakaDay(new Date(e.date)) === fallback);
    }
  }
  const todayExpense = todaysExpenses.reduce((a, e) => a + (e.amount || 0), 0);

  const customerDue =
    sales.reduce((a, o) => a + Math.max(0, (o.total || 0) - (o.paid || 0)), 0) +
    customers.reduce((a, c) => a + Math.max(0, c.openingBalance || 0), 0);
  const supplierPayable = suppliers.reduce((a, s) => a + Math.max(0, s.openingBalance || 0), 0);

  const stockAlerts: StockAlert[] = products
    .filter((p) => (p.stock ?? 0) <= (p.reorderLevel ?? 0))
    .map((p) => ({ productId: p.id, productName: p.name, stock: p.stock, reorderLevel: p.reorderLevel }));

  return {
    todaySales,
    todayCollection,
    todayExpense,
    customerDue,
    supplierPayable,
    cashBalance: Math.round(balanceFor(ledger, "cash")),
    bankBalance: Math.round(balanceFor(ledger, "bank")),
    stockAlerts,
  };
});

// ---------- Health check ----------
export const mongoHealthFn = createServerFn({ method: "GET" }).handler(async () => {
  try {
    await requireUser();
    const db = await getDb();
    await db.command({ ping: 1 });
    await ensureSeeded();
    const counts: Record<string, number> = {};
    for (const name of [
      "customers", "suppliers", "products", "cylinders", "movements",
      "sales", "deliveries", "expenses", "ledger",
    ] as const) {
      counts[name] = await db.collection(name).countDocuments();
    }
    return { ok: true, db: process.env.MONGODB_DB || "insaf_gas_corp", counts };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
});
