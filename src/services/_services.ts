import type {
  Customer, Supplier, Product, Cylinder, CylinderMovement, CylinderStatus,
  SalesOrder, SalesStatus, Delivery, StockAlert, DashboardStats, LineItem,
  Expense, LedgerEntry, PaymentMethod,
} from "@/types";
import { crudFn, dashboardFn } from "@/lib/data.functions";

const call = async <T,>(op: any, coll: any, id?: string, data?: any): Promise<T> => {
  return (await crudFn({ data: { op, coll, id, data } })) as T;
};

async function adjustStock(items: LineItem[], direction: 1 | -1) {
  for (const item of items) {
    const product = await call<Product | null>("get", "products", item.productId);
    if (!product) continue;
    const next = Math.max(0, (product.stock ?? 0) + direction * item.quantity);
    await call("update", "products", item.productId, { stock: next });
  }
}

function statusFromMovement(type: CylinderMovement["type"]): CylinderStatus {
  switch (type) {
    case "issued": return "at_customer";
    case "returned":
    case "received": return "in_stock";
    case "refilled": return "refilling";
    case "transferred": return "in_transit";
    case "damaged": return "damaged";
    default: return "in_stock";
  }
}

async function postLedger(entry: Omit<LedgerEntry, "id">) {
  return call<LedgerEntry>("create", "ledger", undefined, entry);
}

export const customerService = {
  list: () => call<Customer[]>("list", "customers"),
  get: (id: string) => call<Customer | null>("get", "customers", id),
  create: (data: Omit<Customer, "id" | "createdAt">) =>
    call<Customer>("create", "customers", undefined, { ...data, createdAt: new Date().toISOString() }),
  update: (id: string, data: Partial<Customer>) => call<Customer>("update", "customers", id, data),
  remove: (id: string) => call<{ ok: true }>("remove", "customers", id),
};

export const supplierService = {
  list: () => call<Supplier[]>("list", "suppliers"),
  get: (id: string) => call<Supplier | null>("get", "suppliers", id),
  create: (data: Omit<Supplier, "id" | "createdAt">) =>
    call<Supplier>("create", "suppliers", undefined, { ...data, createdAt: new Date().toISOString() }),
  update: (id: string, data: Partial<Supplier>) => call<Supplier>("update", "suppliers", id, data),
  remove: (id: string) => call<{ ok: true }>("remove", "suppliers", id),
};

export const productService = {
  list: () => call<Product[]>("list", "products"),
  get: (id: string) => call<Product | null>("get", "products", id),
  create: (data: Omit<Product, "id" | "createdAt">) =>
    call<Product>("create", "products", undefined, { ...data, createdAt: new Date().toISOString() }),
  update: (id: string, data: Partial<Product>) => call<Product>("update", "products", id, data),
  remove: (id: string) => call<{ ok: true }>("remove", "products", id),
  stockAlerts: async (): Promise<StockAlert[]> => {
    const list = await call<Product[]>("list", "products");
    return list
      .filter((p) => p.stock <= p.reorderLevel)
      .map((p) => ({ productId: p.id, productName: p.name, stock: p.stock, reorderLevel: p.reorderLevel }));
  },
};

export const cylinderService = {
  list: () => call<Cylinder[]>("list", "cylinders"),
  get: (id: string) => call<Cylinder | null>("get", "cylinders", id),
  create: (data: Omit<Cylinder, "id" | "createdAt" | "lastMovementAt">) => {
    const now = new Date().toISOString();
    return call<Cylinder>("create", "cylinders", undefined, { ...data, createdAt: now, lastMovementAt: now });
  },
  update: (id: string, data: Partial<Cylinder>) => call<Cylinder>("update", "cylinders", id, data),
  remove: (id: string) => call<{ ok: true }>("remove", "cylinders", id),
  getMovements: async (cylinderId: string) => {
    const all = await call<CylinderMovement[]>("list", "movements");
    return all.filter((m) => m.cylinderId === cylinderId).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  },
  addMovement: async (data: Omit<CylinderMovement, "id" | "timestamp">) => {
    const now = new Date().toISOString();
    const mv = await call<CylinderMovement>("create", "movements", undefined, { ...data, timestamp: now });
    const status = statusFromMovement(data.type);
    const patch: Record<string, unknown> = {
      lastMovementAt: mv.timestamp,
      status,
    };
    if (data.toLocation) patch.location = data.toLocation;
    if (data.type === "issued") patch.customerId = data.customerId;
    else if (data.type === "returned" || data.type === "received") patch.customerId = null;
    else if (data.customerId) patch.customerId = data.customerId;
    await call("update", "cylinders", data.cylinderId, patch);
    return mv;
  },
};

export const salesService = {
  list: () => call<SalesOrder[]>("list", "sales"),
  get: (id: string) => call<SalesOrder | null>("get", "sales", id),
  create: async (data: Omit<SalesOrder, "id">) => {
    const order = await call<SalesOrder>("create", "sales", undefined, data);
    if (data.status === "confirmed" || data.status === "invoiced") {
      await adjustStock(data.items, -1);
    }
    return order;
  },
  update: (id: string, data: Partial<SalesOrder>) => call<SalesOrder>("update", "sales", id, data),
  remove: (id: string) => call<{ ok: true }>("remove", "sales", id),
  setStatus: async (id: string, status: SalesStatus) => {
    const order = await call<SalesOrder | null>("get", "sales", id);
    if (!order) throw new Error("Order not found");
    if (order.status === "cancelled" || order.status === "paid") {
      throw new Error(`Cannot change status from ${order.status}`);
    }
    if (order.status === "draft" && (status === "confirmed" || status === "invoiced")) {
      await adjustStock(order.items, -1);
    }
    if ((order.status === "confirmed" || order.status === "invoiced") && status === "cancelled") {
      await adjustStock(order.items, 1);
    }
    return call<SalesOrder>("update", "sales", id, { status });
  },
  convertQuotation: async (id: string) => {
    const order = await call<SalesOrder | null>("get", "sales", id);
    if (!order) throw new Error("Quotation not found");
    if (order.status !== "draft") throw new Error("Only draft quotations can be converted");
    await adjustStock(order.items, -1);
    return call<SalesOrder>("update", "sales", id, {
      status: "confirmed",
      orderNo: order.orderNo.startsWith("QT") ? order.orderNo.replace(/^QT/, "SO") : order.orderNo,
    });
  },
  recordPayment: async (id: string, amount: number, method: PaymentMethod = "cash") => {
    const order = await call<SalesOrder | null>("get", "sales", id);
    if (!order) throw new Error("order not found");
    if (amount <= 0) throw new Error("Amount must be positive");
    const due = order.total - order.paid;
    if (amount > due) throw new Error("Amount exceeds due balance");
    const paid = order.paid + amount;
    let status: SalesStatus = order.status;
    if (paid >= order.total) status = "paid";
    else if (order.status === "confirmed" || order.status === "draft") status = "invoiced";

    const updated = await call<SalesOrder>("update", "sales", id, { paid, status });
    await postLedger({
      date: new Date().toISOString(),
      account: method,
      direction: "in",
      amount,
      category: "collection",
      refType: "sales",
      refId: id,
      notes: `Payment for ${order.orderNo}`,
    });
    return updated;
  },
  dashboard: async (): Promise<DashboardStats & { stockAlerts: StockAlert[] }> => {
    return await dashboardFn();
  },
};

export const deliveryService = {
  list: () => call<Delivery[]>("list", "deliveries"),
  get: (id: string) => call<Delivery | null>("get", "deliveries", id),
  create: (data: Omit<Delivery, "id">) => call<Delivery>("create", "deliveries", undefined, data),
  update: (id: string, data: Partial<Delivery>) => call<Delivery>("update", "deliveries", id, data),
  remove: (id: string) => call<{ ok: true }>("remove", "deliveries", id),
  confirm: async (id: string) => {
    const delivery = await call<Delivery | null>("get", "deliveries", id);
    if (!delivery) throw new Error("Delivery not found");
    if (delivery.status !== "pending") throw new Error("Already confirmed");

    if (!delivery.salesOrderId) {
      await adjustStock(delivery.items, -1);
    } else {
      const so = await call<SalesOrder | null>("get", "sales", delivery.salesOrderId);
      if (so && so.status === "confirmed") {
        await call("update", "sales", so.id, { status: "invoiced" });
      }
    }

    return call<Delivery>("update", "deliveries", id, {
      status: "delivered",
      confirmedAt: new Date().toISOString(),
    });
  },
};

export const expenseService = {
  list: () => call<Expense[]>("list", "expenses"),
  get: (id: string) => call<Expense | null>("get", "expenses", id),
  create: async (data: Omit<Expense, "id" | "createdAt">) => {
    const now = new Date().toISOString();
    const expense = await call<Expense>("create", "expenses", undefined, { ...data, createdAt: now });
    await postLedger({
      date: data.date || now,
      account: data.paymentMethod,
      direction: "out",
      amount: data.amount,
      category: "expense",
      refType: "expense",
      refId: expense.id,
      notes: data.description,
    });
    return expense;
  },
  remove: async (id: string) => {
    const expense = await call<Expense | null>("get", "expenses", id);
    if (expense) {
      const ledger = await call<LedgerEntry[]>("list", "ledger");
      const linked = ledger.filter((e) => e.refType === "expense" && e.refId === id);
      for (const entry of linked) {
        await call("remove", "ledger", entry.id);
      }
    }
    return call<{ ok: true }>("remove", "expenses", id);
  },
};
