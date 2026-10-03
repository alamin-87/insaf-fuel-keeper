import { createServerFn } from "@tanstack/react-start";
import { allSeed } from "./seed-data";
import { isDemoLoginEnabled, requireUser } from "./session.server";
import { issueLockExpiredBefore } from "./cylinder-lock";
import { isKnownCrudCollection, modulesForCrud } from "./crud-access";
import { normalizeSerialKey, trackingEnforcesSerialUnique } from "./cylinder-serial";
import type {
  Customer,
  Supplier,
  Product,
  SalesOrder,
  DashboardStats,
  StockAlert,
  Expense,
  LedgerEntry,
  Cylinder,
  PurchaseOrder,
  Voucher,
  Account,
  Delivery,
  StockMovement,
} from "@/types";
import { isBankBookAccount, isCashBookAccount } from "@/lib/money-accounts";
import { creditReminderNotice, customerOpeningSigned } from "@/lib/customer-balance";
import { computeCustomerReceivables, computeSupplierPayables } from "@/lib/accounting-engine";

async function getDb() {
  const { getDb: loadDb } = await import("./mongo.server");
  return loadDb();
}

type CollName =
  | "customers"
  | "suppliers"
  | "products"
  | "cylinders"
  | "movements"
  | "sales"
  | "deliveries"
  | "expenses"
  | "ledger"
  | "purchases"
  | "stockMovements"
  | "vouchers"
  | "employees"
  | "payroll"
  | "appUsers"
  | "accounts"
  | "chartOfAccounts"
  | "assets"
  | "costLayers";

// Strip Mongo's _id so returned docs are plain and serializable.
const clean = <T>(doc: any): T => {
  if (!doc) return doc;
  const { _id, ...rest } = doc;
  return rest as T;
};

let seedPromise: Promise<void> | null = null; // cached seed promise
async function ensureSeeded() {
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    const db = await getDb();
    const collections = Object.keys(allSeed) as CollName[];
    for (const name of collections) {
      if (name === "appUsers" && !isDemoLoginEnabled()) continue;
      const coll = db.collection(name);
      // Unique index on business `id` prevents duplicate seed rows across races.
      try {
        await coll.createIndex({ id: 1 }, { unique: true });
      } catch {}
      if (name === "cylinders") await ensureCylinderSerialIndex(db);
      if (name === "stockMovements") {
        try {
          await coll.createIndex({ refType: 1, refId: 1, productId: 1, type: 1 });
        } catch {}
      }
      if (name === "sales") {
        try {
          await coll.createIndex({ orderNo: 1 }, { unique: true, sparse: true });
        } catch {}
      }
      if (name === "purchases") {
        try {
          await coll.createIndex({ orderNo: 1 }, { unique: true, sparse: true });
        } catch {}
      }
      if (name === "vouchers") {
        try {
          await coll.createIndex({ voucherNo: 1 }, { unique: true, sparse: true });
        } catch {}
      }
      if (name === "deliveries") {
        try {
          await coll.createIndex({ challanNo: 1 }, { unique: true, sparse: true });
        } catch {}
      }
      const count = await coll.estimatedDocumentCount();
      if (count === 0) {
        const docs = (allSeed as any)[name] as any[];
        if (docs.length > 0) {
          try {
            await coll.insertMany(
              docs.map((d) => ({ ...d })),
              { ordered: false },
            );
          } catch {}
        }
      }
    }

    // Migration / Backfill: Reconcile product stock with authoritative transaction history
    try {
      const { buildStockReport } = await import("./stock-report");
      const dbProducts = await db.collection("products").find({}).toArray();
      const dbMovements = await db.collection("stockMovements").find({}).toArray();
      const prods = dbProducts.map((d: any) => clean<Product>(d));
      const moves = dbMovements.map((d: any) => clean<StockMovement>(d));
      const reports = buildStockReport(prods, moves, { preset: "all", from: "", to: "" });
      for (const r of reports) {
        const prod = prods.find((p) => p.id === r.id);
        if (prod && prod.stock !== r.inHand) {
          await db.collection("products").updateOne({ id: r.id }, { $set: { stock: r.inHand } });
        }
      }
    } catch {
      /* ignore migration race */
    }
  })().catch((e) => {
    seedPromise = null;
    throw e;
  });
  return seedPromise;
}

async function collAll<T>(name: CollName): Promise<T[]> {
  const db = await getDb();
  await ensureSeeded();
  const docs = await db
    .collection(name)
    .find({})
    .sort({ createdAt: -1, date: -1, timestamp: -1 })
    .toArray();
  return docs.map((d) => {
    const c = clean<any>(d);
    if (name === "appUsers") {
      delete c.password;
      delete c.passwordHash;
    }
    return c as T;
  });
}

async function findById(name: CollName, id: string) {
  const db = await getDb();
  return db.collection(name).findOne({ id: String(id) });
}

async function collGet<T>(name: CollName, id: string): Promise<T | null> {
  const db = await getDb();
  await ensureSeeded();
  const doc = await findById(name, id);
  if (!doc) return null;
  const c = clean<any>(doc);
  if (name === "appUsers") {
    delete c.password;
    delete c.passwordHash;
  }
  return c as T;
}

async function ensureCylinderSerialIndex(db?: Awaited<ReturnType<typeof getDb>>) {
  const database = db ?? (await getDb());
  try {
    await database.collection("cylinders").createIndex(
      { serialKey: 1 },
      {
        unique: true,
        name: "cylinders_serialKey_unique",
        partialFilterExpression: { serialKey: { $type: "string", $gt: "" } },
      },
    );
  } catch {
    /* Existing duplicate serials are left in place; new serial-mode writes still hit E11000 if the index exists. */
  }
}

function isDuplicateKeyError(e: unknown) {
  const err = e as { code?: number; message?: string };
  return err?.code === 11000 || /E11000|duplicate key/i.test(err?.message || "");
}

async function serialTaken(serial: string, excludeId?: string) {
  const key = normalizeSerialKey(serial);
  if (!key) return false;
  const db = await getDb();
  const docs = await db
    .collection("cylinders")
    .find(excludeId ? { id: { $ne: excludeId } } : {}, {
      projection: { id: 1, serialNumber: 1, serialKey: 1 },
    })
    .toArray();
  return docs.some((d) => {
    const stored =
      typeof d.serialKey === "string" && d.serialKey
        ? d.serialKey
        : normalizeSerialKey(d.serialNumber);
    return stored === key;
  });
}

async function collCreate<T extends { id?: string }>(
  name: CollName,
  data: any,
  user?: { username?: string },
): Promise<T> {
  const db = await getDb();
  await ensureSeeded();
  const { getNextSequence } = await import("./document-sequence");
  const id = data.id ?? Math.random().toString(36).slice(2, 10);
  const doc: Record<string, unknown> = {
    ...data,
    id,
    createdAt: data.createdAt ?? new Date().toISOString(),
  };

  // Database-backed collision-safe sequence numbering
  if (name === "sales" && (!doc.orderNo || String(doc.orderNo).startsWith("SO-"))) {
    if (!doc.orderNo || String(doc.orderNo).length < 15) {
      doc.orderNo = await getNextSequence(db, "SO");
    }
  } else if (name === "purchases" && (!doc.orderNo || String(doc.orderNo).startsWith("PO-"))) {
    if (!doc.orderNo || String(doc.orderNo).length < 15) {
      doc.orderNo = await getNextSequence(db, "PO");
    }
  } else if (
    name === "vouchers" &&
    (!doc.voucherNo ||
      String(doc.voucherNo).startsWith("RV-") ||
      String(doc.voucherNo).startsWith("PV-") ||
      String(doc.voucherNo).startsWith("JV-"))
  ) {
    const pfx = String(doc.voucherNo || "").slice(0, 2) || "RV";
    if (!doc.voucherNo || String(doc.voucherNo).length < 15) {
      doc.voucherNo = await getNextSequence(db, pfx);
    }
  } else if (name === "deliveries" && (!doc.challanNo || String(doc.challanNo).startsWith("DC-"))) {
    if (!doc.challanNo || String(doc.challanNo).length < 15) {
      doc.challanNo = await getNextSequence(db, "DC");
    }
  }

  if (name === "cylinders") {
    await ensureCylinderSerialIndex(db);
    const { getCylinderTracking } = await import("./settings.server");
    const method = await getCylinderTracking();
    const serial = String(data?.serialNumber || "");
    if (trackingEnforcesSerialUnique(method)) {
      const serialKey = normalizeSerialKey(serial);
      if (serialKey && (await serialTaken(serial))) {
        throw new Error(`Serial number ${serial} is already assigned`);
      }
      if (serialKey) doc.serialKey = serialKey;
    } else {
      delete doc.serialKey;
    }
  }
  try {
    await db.collection(name).insertOne(doc);
  } catch (e) {
    if (name === "cylinders" && isDuplicateKeyError(e)) {
      throw new Error(`Serial number ${data?.serialNumber} is already assigned`);
    }
    if (isDuplicateKeyError(e)) {
      throw new Error(`Duplicate document key error in ${name}`);
    }
    throw e;
  }

  try {
    const { logAudit } = await import("./audit");
    await logAudit(db, {
      userId: user?.username || "system",
      username: user?.username || "system",
      action: "CREATE",
      entityType: name as any,
      entityId: id,
      after: doc,
      details: `Created record in ${name} (id: ${id})`,
    });
  } catch {}

  return clean<T>(doc);
}

async function collUpdate<T>(
  name: CollName,
  id: string,
  patch: any,
  user?: { username?: string },
): Promise<T> {
  const db = await getDb();
  await ensureSeeded();
  if (!id) throw new Error("Missing record id");
  if (!patch || typeof patch !== "object") throw new Error("Missing update payload");
  const { _id, id: _ignore, createdAt: _createdAt, ...rest } = patch;
  const update: { $set: Record<string, unknown>; $unset?: Record<string, string> } = { $set: rest };
  if (name === "cylinders" && rest.serialNumber != null) {
    await ensureCylinderSerialIndex(db);
    const { getCylinderTracking } = await import("./settings.server");
    const method = await getCylinderTracking();
    if (trackingEnforcesSerialUnique(method)) {
      if (await serialTaken(String(rest.serialNumber), String(id))) {
        throw new Error(`Serial number ${rest.serialNumber} is already assigned`);
      }
      const serialKey = normalizeSerialKey(String(rest.serialNumber));
      if (serialKey) rest.serialKey = serialKey;
      else {
        delete rest.serialKey;
        update.$unset = { ...(update.$unset || {}), serialKey: "" };
      }
    } else {
      delete rest.serialKey;
      update.$unset = { ...(update.$unset || {}), serialKey: "" };
    }
  }
  const existing = await findById(name, id);
  if (!existing) throw new Error(`Record not found (${name}/${id})`);
  const filter = existing.id != null ? { id: String(existing.id) } : { _id: existing._id };
  try {
    const result = await db.collection(name).updateOne(filter, update);
    if (result.matchedCount === 0) {
      throw new Error(`Record not found (${name}/${id})`);
    }
  } catch (e) {
    if (name === "cylinders" && isDuplicateKeyError(e)) {
      throw new Error(`Serial number ${rest.serialNumber} is already assigned`);
    }
    if (isDuplicateKeyError(e)) {
      throw new Error(`Duplicate document key error in ${name}`);
    }
    throw e;
  }
  const doc = await findById(name, String(existing.id ?? id));
  if (!doc) throw new Error("Update failed — record missing after write");

  try {
    const { logAudit } = await import("./audit");
    await logAudit(db, {
      userId: user?.username || "system",
      username: user?.username || "system",
      action: "UPDATE",
      entityType: name as any,
      entityId: id,
      before: clean(existing),
      after: clean(doc),
      details: `Updated record in ${name} (id: ${id})`,
    });
  } catch {}

  return clean<T>(doc);
}

async function collClaim(name: CollName, id: string, payload?: { statuses?: string[] }) {
  if (name !== "cylinders") throw new Error("Claim is only supported for cylinders");
  const statuses = payload?.statuses?.length ? payload.statuses : ["in_stock"];
  const db = await getDb();
  await ensureSeeded();
  const staleBefore = issueLockExpiredBefore();
  const result = await db.collection("cylinders").findOneAndUpdate(
    {
      id: String(id),
      status: { $in: statuses },
      $or: [
        { issueLock: { $exists: false } },
        { issueLock: null },
        { issueLock: "" },
        { issueLock: { $lt: staleBefore } },
      ],
    },
    { $set: { issueLock: new Date().toISOString() } },
    { returnDocument: "after" },
  );
  const doc = (result as { value?: unknown } | null)?.value ?? result;
  if (!doc || typeof doc !== "object" || !("id" in doc)) {
    throw new Error("Cylinder is no longer available");
  }
  return clean(doc);
}

async function collRemove(name: CollName, id: string, user?: { username?: string }): Promise<void> {
  const db = await getDb();
  await ensureSeeded();
  if (!id) throw new Error("Missing record id");
  const existing = await findById(name, id);
  const result = await db.collection(name).deleteOne({ id: String(id) });
  if (result.deletedCount === 0) {
    throw new Error(`Record not found (${name}/${id})`);
  }

  try {
    const { logAudit } = await import("./audit");
    await logAudit(db, {
      userId: user?.username || "system",
      username: user?.username || "system",
      action: "DELETE",
      entityType: name as any,
      entityId: id,
      before: existing ? clean(existing) : null,
      details: `Deleted record in ${name} (id: ${id})`,
    });
  } catch {}
}

// ---------- Generic CRUD server functions ----------
type CrudInput = {
  op: "list" | "get" | "create" | "update" | "remove" | "claim";
  coll: CollName;
  id?: string;
  /** Record body for create/update — avoid naming this `data` (conflicts with server-fn wrapper). */
  payload?: any;
};

export const crudFn = createServerFn({ method: "POST" })
  .inputValidator((d: CrudInput) => d)
  .handler(async ({ data }): Promise<any> => {
    const user = await requireUser();
    if (!isKnownCrudCollection(data.coll)) {
      throw new Error("Not allowed");
    }
    const { permissionForCrud } = await import("./crud-access");
    const { assertPermission } = await import("./rbac");
    const requiredPermission = permissionForCrud(data.coll, data.op);
    assertPermission(user, requiredPermission);

    const id = data.id != null ? String(data.id) : undefined;
    switch (data.op) {
      case "list":
        return await collAll(data.coll);
      case "get":
        return await collGet(data.coll, id!);
      case "create":
        return await collCreate(data.coll, data.payload, user);
      case "update":
        return await collUpdate(data.coll, id!, data.payload, user);
      case "remove":
        await collRemove(data.coll, id!, user);
        return { ok: true };
      case "claim":
        return await collClaim(data.coll, id!, data.payload);
      default:
        return null;
    }
  });

function dhakaDay(d: Date) {
  const shifted = new Date(d.getTime() + 6 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

function balanceFor(ledger: LedgerEntry[], account: "cash" | "bank", named: Account[] = []) {
  return ledger
    .filter((e) =>
      account === "bank"
        ? isBankBookAccount(e.account, named)
        : isCashBookAccount(e.account, named),
    )
    .reduce((a, e) => a + (e.direction === "in" ? e.amount : -e.amount), 0);
}

// ---------- Dashboard aggregation ----------
export const dashboardFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardStats & { stockAlerts: StockAlert[] }> => {
    await requireUser();
    const db = await getDb();
    await ensureSeeded();

    const sales = (await db.collection("sales").find({}).toArray()) as unknown as SalesOrder[];
    const products = (await db.collection("products").find({}).toArray()) as unknown as Product[];
    const suppliers = (await db
      .collection("suppliers")
      .find({})
      .toArray()) as unknown as Supplier[];
    const customers = (await db
      .collection("customers")
      .find({})
      .toArray()) as unknown as Customer[];
    const expenses = (await db.collection("expenses").find({}).toArray()) as unknown as Expense[];
    const ledger = (await db.collection("ledger").find({}).toArray()) as unknown as LedgerEntry[];
    const cylinders = (await db
      .collection("cylinders")
      .find({})
      .toArray()) as unknown as Cylinder[];
    const purchases = (await db
      .collection("purchases")
      .find({})
      .toArray()) as unknown as PurchaseOrder[];

    const todayStr = dhakaDay(new Date());
    const todaysOrders = sales.filter(
      (s) =>
        s.date &&
        dhakaDay(new Date(s.date)) === todayStr &&
        s.status !== "cancelled" &&
        s.status !== "draft",
    );
    const todaySales = todaysOrders.reduce((a, o) => a + (o.total || 0), 0);
    const todayCollection = todaysOrders.reduce((a, o) => a + (o.paid || 0), 0);

    const todaysExpenses = expenses.filter(
      (e) => e.date && dhakaDay(new Date(e.date)) === todayStr,
    );
    const todayExpense = todaysExpenses.reduce((a, e) => a + (e.amount || 0), 0);

    const vouchers = (await db.collection("vouchers").find({}).toArray()) as unknown as Voucher[];
    const namedAccounts = (await db
      .collection("accounts")
      .find({})
      .toArray()) as unknown as Account[];

    const { totalDue: customerDue } = computeCustomerReceivables(customers, sales, vouchers);
    const { totalDue: supplierPayable } = computeSupplierPayables(suppliers, purchases, vouchers);

    const monthPrefix = todayStr.slice(0, 7);
    const monthlySales = sales
      .filter(
        (s) =>
          s.date &&
          dhakaDay(new Date(s.date)).startsWith(monthPrefix) &&
          s.status !== "cancelled" &&
          s.status !== "draft",
      )
      .reduce((a, o) => a + (o.total || 0), 0);

    const stockAlerts: StockAlert[] = products
      .filter((p) => (p.stock ?? 0) <= (p.reorderLevel ?? 0))
      .map((p) => ({
        productId: p.id,
        productName: p.name,
        stock: p.stock,
        reorderLevel: p.reorderLevel,
      }));

    const countStatus = (status: Cylinder["status"]) =>
      cylinders.filter((c) => c.status === status).length;

    return {
      todaySales,
      todayCollection,
      todayExpense,
      customerDue,
      supplierPayable,
      cashBalance: Math.round(balanceFor(ledger, "cash", namedAccounts)),
      bankBalance: Math.round(balanceFor(ledger, "bank", namedAccounts)),
      availableStock: products.reduce((a, p) => a + (p.stock || 0), 0),
      cylindersInWarehouse: countStatus("in_stock"),
      cylindersWithCustomers: countStatus("at_customer"),
      cylindersUnderRefill: countStatus("refilling"),
      damagedCylinders: countStatus("damaged"),
      lostCylinders: countStatus("lost"),
      monthlySales,
      stockAlerts,
    };
  },
);

// ---------- Notifications aggregation ----------
export const notificationsFn = createServerFn({ method: "GET" }).handler(async () => {
  await requireUser();
  const db = await getDb();
  await ensureSeeded();

  const products = (await db.collection("products").find({}).toArray()) as unknown as Product[];
  const lowStock = products.filter((p) => (p.stock || 0) <= (p.reorderLevel || 0));

  const pendingDeliveries = (await db
    .collection("deliveries")
    .find({ status: "pending" })
    .toArray()) as unknown as Delivery[];
  const pendingPurchases = (await db
    .collection("purchases")
    .find({ status: { $in: ["ordered", "partial"] } })
    .toArray()) as unknown as PurchaseOrder[];
  const pendingSales = (await db
    .collection("sales")
    .find({ status: "confirmed" })
    .toArray()) as unknown as SalesOrder[];

  const customers = (await db.collection("customers").find({}).toArray()) as unknown as Customer[];
  const sales = (await db.collection("sales").find({}).toArray()) as unknown as SalesOrder[];
  const vouchers = (await db.collection("vouchers").find({}).toArray()) as unknown as Voucher[];
  const creditReminders = customers
    .map((c) => creditReminderNotice(c, sales, vouchers))
    .filter((n): n is NonNullable<typeof n> => n != null);

  return {
    lowStock: lowStock.map((p) => ({
      id: p.id,
      name: p.name,
      stock: p.stock,
      reorderLevel: p.reorderLevel,
    })),
    pendingDeliveries: pendingDeliveries.map((d) => ({
      id: d.id,
      challanNo: d.challanNo,
      customerName: d.customerName,
    })),
    pendingPurchases: pendingPurchases.map((p) => ({
      id: p.id,
      orderNo: p.orderNo,
      supplierName: p.supplierName,
    })),
    pendingSales: pendingSales.map((s) => ({
      id: s.id,
      orderNo: s.orderNo,
      customerName: s.customerName,
    })),
    creditReminders,
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
      "customers",
      "suppliers",
      "products",
      "cylinders",
      "movements",
      "sales",
      "deliveries",
      "expenses",
      "ledger",
      "purchases",
      "stockMovements",
      "vouchers",
      "employees",
      "payroll",
      "accounts",
      "chartOfAccounts",
      "assets",
    ] as const) {
      counts[name] = await db.collection(name).countDocuments();
    }
    return { ok: true, db: process.env.MONGODB_DB || "insaf_gas_corp", counts };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
});
