import type {
  Customer, Supplier, Product, Cylinder, CylinderMovement, CylinderStatus,
  SalesOrder, SalesStatus, Delivery, StockAlert, DashboardStats, LineItem,
  Expense, LedgerEntry, PaymentMethod, PurchaseOrder, PurchaseStatus,
  StockMovement, Voucher, VoucherType, Employee, PayrollRun,
} from "@/types";
import { crudFn, dashboardFn } from "@/lib/data.functions";
import { genOrderNo } from "@/utils/helpers";

const call = async <T,>(op: any, coll: any, id?: string, payload?: any): Promise<T> => {
  return (await crudFn({ data: { op, coll, id, payload } })) as T;
};

async function postStockMovement(data: Omit<StockMovement, "id">) {
  return call<StockMovement>("create", "stockMovements", undefined, data);
}

async function adjustStock(
  items: LineItem[],
  direction: 1 | -1,
  meta?: { refType?: StockMovement["refType"]; refId?: string; notes?: string; by?: string },
) {
  for (const item of items) {
    const product = await call<Product | null>("get", "products", item.productId);
    if (!product) continue;
    const next = Math.max(0, (product.stock ?? 0) + direction * item.quantity);
    await call("update", "products", item.productId, { stock: next });
    await postStockMovement({
      date: new Date().toISOString(),
      productId: product.id,
      productName: product.name,
      type: direction > 0 ? "in" : "out",
      quantity: item.quantity,
      balanceAfter: next,
      refType: meta?.refType,
      refId: meta?.refId,
      notes: meta?.notes,
      by: meta?.by ?? "System",
    });
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
    case "lost": return "lost";
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
    const patch: Record<string, unknown> = { lastMovementAt: mv.timestamp, status };
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
      await adjustStock(data.items, -1, { refType: "sales", refId: order.id, notes: order.orderNo, by: "Sales" });
    }
    return order;
  },
  update: async (id: string, data: Partial<SalesOrder>) => {
    const existing = await call<SalesOrder | null>("get", "sales", id);
    if (!existing) throw new Error("Order not found");
    const wasStocked = existing.status === "confirmed" || existing.status === "invoiced" || existing.status === "paid";
    if (wasStocked && data.items) {
      await adjustStock(existing.items, 1, {
        refType: "sales", refId: id, notes: `Edit reverse ${existing.orderNo}`, by: "Sales",
      });
      await adjustStock(data.items, -1, {
        refType: "sales", refId: id, notes: `Edit apply ${existing.orderNo}`, by: "Sales",
      });
    }
    return call<SalesOrder>("update", "sales", id, data);
  },
  remove: async (id: string) => {
    const existing = await call<SalesOrder | null>("get", "sales", id);
    if (!existing) throw new Error("Order not found");
    if (existing.status === "confirmed" || existing.status === "invoiced" || existing.status === "paid") {
      await adjustStock(existing.items, 1, {
        refType: "sales", refId: id, notes: `Delete ${existing.orderNo}`, by: "Sales",
      });
    }
    const ledger = await call<LedgerEntry[]>("list", "ledger");
    for (const entry of ledger.filter((e) => e.refType === "sales" && e.refId === id)) {
      await call("remove", "ledger", entry.id);
    }
    return call<{ ok: true }>("remove", "sales", id);
  },
  setStatus: async (id: string, status: SalesStatus) => {
    const order = await call<SalesOrder | null>("get", "sales", id);
    if (!order) throw new Error("Order not found");
    if (order.status === "cancelled" || order.status === "paid") {
      throw new Error(`Cannot change status from ${order.status}`);
    }
    if (order.status === "draft" && (status === "confirmed" || status === "invoiced")) {
      await adjustStock(order.items, -1, { refType: "sales", refId: id, notes: order.orderNo, by: "Sales" });
    }
    if ((order.status === "confirmed" || order.status === "invoiced") && status === "cancelled") {
      await adjustStock(order.items, 1, { refType: "sales", refId: id, notes: `Cancel ${order.orderNo}`, by: "Sales" });
    }
    return call<SalesOrder>("update", "sales", id, { status });
  },
  convertQuotation: async (id: string) => {
    const order = await call<SalesOrder | null>("get", "sales", id);
    if (!order) throw new Error("Quotation not found");
    if (order.status !== "draft") throw new Error("Only draft quotations can be converted");
    await adjustStock(order.items, -1, { refType: "sales", refId: id, notes: order.orderNo, by: "Sales" });
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
      account: method === "cheque" || method === "mobile" ? "bank" : method,
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
  update: async (id: string, data: Partial<Delivery>) => {
    const existing = await call<Delivery | null>("get", "deliveries", id);
    if (!existing) throw new Error("Delivery not found");
    if (existing.status !== "pending") throw new Error("Only pending deliveries can be edited");
    return call<Delivery>("update", "deliveries", id, data);
  },
  remove: async (id: string) => {
    const existing = await call<Delivery | null>("get", "deliveries", id);
    if (!existing) throw new Error("Delivery not found");
    if (existing.status !== "pending") throw new Error("Only pending deliveries can be deleted");
    return call<{ ok: true }>("remove", "deliveries", id);
  },
  confirm: async (id: string) => {
    const delivery = await call<Delivery | null>("get", "deliveries", id);
    if (!delivery) throw new Error("Delivery not found");
    if (delivery.status !== "pending" && delivery.status !== "in_transit") {
      throw new Error("Already confirmed");
    }

    if (!delivery.salesOrderId) {
      await adjustStock(delivery.items, -1, {
        refType: "delivery", refId: id, notes: delivery.challanNo, by: "Delivery",
      });
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
    const account = data.paymentMethod === "cheque" || data.paymentMethod === "mobile" ? "bank" : data.paymentMethod;
    await postLedger({
      date: data.date || now,
      account,
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
  update: async (id: string, data: Partial<Expense>) => {
    const existing = await call<Expense | null>("get", "expenses", id);
    if (!existing) throw new Error("Expense not found");
    const ledger = await call<LedgerEntry[]>("list", "ledger");
    const linked = ledger.filter((e) => e.refType === "expense" && e.refId === id);
    for (const entry of linked) {
      await call("remove", "ledger", entry.id);
    }
    const updated = await call<Expense>("update", "expenses", id, data);
    const paymentMethod = updated.paymentMethod ?? existing.paymentMethod;
    const account = paymentMethod === "cheque" || paymentMethod === "mobile" ? "bank" : paymentMethod;
    await postLedger({
      date: updated.date || existing.date,
      account,
      direction: "out",
      amount: updated.amount,
      category: "expense",
      refType: "expense",
      refId: id,
      notes: updated.description,
    });
    return updated;
  },
};

export const purchaseService = {
  list: () => call<PurchaseOrder[]>("list", "purchases"),
  get: (id: string) => call<PurchaseOrder | null>("get", "purchases", id),
  create: async (data: Omit<PurchaseOrder, "id">) => {
    return call<PurchaseOrder>("create", "purchases", undefined, data);
  },
  update: async (id: string, data: Partial<PurchaseOrder>) => {
    const existing = await call<PurchaseOrder | null>("get", "purchases", id);
    if (!existing) throw new Error("Purchase order not found");
    if (existing.status !== "draft" && existing.status !== "ordered") {
      throw new Error("Only draft or ordered POs can be edited");
    }
    if (existing.paid > 0) throw new Error("Cannot edit a PO with payments");
    return call<PurchaseOrder>("update", "purchases", id, data);
  },
  remove: async (id: string) => {
    const existing = await call<PurchaseOrder | null>("get", "purchases", id);
    if (!existing) throw new Error("Purchase order not found");
    if (existing.status !== "draft" && existing.status !== "cancelled") {
      throw new Error("Only draft or cancelled POs can be deleted");
    }
    const ledger = await call<LedgerEntry[]>("list", "ledger");
    for (const entry of ledger.filter((e) => e.refType === "purchase" && e.refId === id)) {
      await call("remove", "ledger", entry.id);
    }
    return call<{ ok: true }>("remove", "purchases", id);
  },
  setStatus: async (id: string, status: PurchaseStatus) => {
    const po = await call<PurchaseOrder | null>("get", "purchases", id);
    if (!po) throw new Error("Purchase order not found");
    if (po.status === "cancelled" || po.status === "paid") {
      throw new Error(`Cannot change status from ${po.status}`);
    }
    if (status === "cancelled" && (po.status === "received" || po.status === "billed")) {
      throw new Error("Cannot cancel after goods received");
    }
    return call<PurchaseOrder>("update", "purchases", id, { status });
  },
  receive: async (id: string) => {
    const po = await call<PurchaseOrder | null>("get", "purchases", id);
    if (!po) throw new Error("Purchase order not found");
    if (po.status !== "ordered" && po.status !== "draft") {
      throw new Error("Only ordered/draft POs can be received");
    }
    const grnNo = genOrderNo("GRN");
    await adjustStock(po.items, 1, { refType: "purchase", refId: id, notes: grnNo, by: "Warehouse" });
    return call<PurchaseOrder>("update", "purchases", id, {
      status: "received",
      grnNo,
      receivedAt: new Date().toISOString(),
    });
  },
  recordPayment: async (id: string, amount: number, method: PaymentMethod = "bank") => {
    const po = await call<PurchaseOrder | null>("get", "purchases", id);
    if (!po) throw new Error("Purchase order not found");
    if (amount <= 0) throw new Error("Amount must be positive");
    const due = po.total - po.paid;
    if (amount > due) throw new Error("Amount exceeds due balance");
    const paid = po.paid + amount;
    let status: PurchaseStatus = po.status === "ordered" || po.status === "draft" ? "billed" : po.status;
    if (po.status === "received") status = "billed";
    if (paid >= po.total) status = "paid";
    const updated = await call<PurchaseOrder>("update", "purchases", id, { paid, status });
    const account = method === "cheque" || method === "mobile" ? "bank" : method;
    await postLedger({
      date: new Date().toISOString(),
      account,
      direction: "out",
      amount,
      category: "purchase",
      refType: "purchase",
      refId: id,
      notes: `Payment for ${po.orderNo}`,
    });
    return updated;
  },
};

export const inventoryService = {
  listMovements: () => call<StockMovement[]>("list", "stockMovements"),
  adjust: async (productId: string, quantity: number, type: "in" | "out" | "adjust", notes?: string) => {
    const product = await call<Product | null>("get", "products", productId);
    if (!product) throw new Error("Product not found");
    if (quantity <= 0) throw new Error("Quantity must be positive");
    let next = product.stock;
    if (type === "in") next += quantity;
    else if (type === "out") next = Math.max(0, next - quantity);
    else next = quantity;
    await call("update", "products", productId, { stock: next });
    return postStockMovement({
      date: new Date().toISOString(),
      productId,
      productName: product.name,
      type,
      quantity: type === "adjust" ? Math.abs(next - product.stock) : quantity,
      balanceAfter: next,
      refType: "adjustment",
      notes: notes || "Manual stock adjustment",
      by: "Warehouse",
    });
  },
};

export const accountingService = {
  listLedger: () => call<LedgerEntry[]>("list", "ledger"),
  listVouchers: () => call<Voucher[]>("list", "vouchers"),
  createVoucher: async (data: {
    type: VoucherType;
    account: PaymentMethod;
    amount: number;
    partyName?: string;
    notes?: string;
  }) => {
    if (data.amount <= 0) throw new Error("Amount must be positive");
    const prefix = data.type === "receipt" ? "RV" : data.type === "payment" ? "PV" : "JV";
    const voucher = await call<Voucher>("create", "vouchers", undefined, {
      voucherNo: genOrderNo(prefix),
      type: data.type,
      date: new Date().toISOString(),
      account: data.account,
      amount: data.amount,
      partyName: data.partyName,
      notes: data.notes,
      createdAt: new Date().toISOString(),
    });
    const account = data.account === "cheque" || data.account === "mobile" ? "bank" : data.account === "cash" || data.account === "bank" ? data.account : "cash";
    if (data.type !== "journal") {
      await postLedger({
        date: voucher.date,
        account,
        direction: data.type === "receipt" ? "in" : "out",
        amount: data.amount,
        category: data.type === "receipt" ? "receipt" : "payment",
        refType: "voucher",
        refId: voucher.id,
        notes: data.notes || voucher.voucherNo,
      });
    } else {
      await postLedger({
        date: voucher.date,
        account,
        direction: "in",
        amount: data.amount,
        category: "journal",
        refType: "voucher",
        refId: voucher.id,
        notes: data.notes || voucher.voucherNo,
      });
    }
    return voucher;
  },
  removeVoucher: async (id: string) => {
    const voucher = await call<Voucher | null>("get", "vouchers", id);
    if (!voucher) throw new Error("Voucher not found");
    const ledger = await call<LedgerEntry[]>("list", "ledger");
    for (const entry of ledger.filter((e) => e.refType === "voucher" && e.refId === id)) {
      await call("remove", "ledger", entry.id);
    }
    return call<{ ok: true }>("remove", "vouchers", id);
  },
};

export const hrService = {
  listEmployees: () => call<Employee[]>("list", "employees"),
  getEmployee: (id: string) => call<Employee | null>("get", "employees", id),
  createEmployee: (data: Omit<Employee, "id" | "createdAt" | "employeeNo">) =>
    call<Employee>("create", "employees", undefined, {
      ...data,
      employeeNo: genOrderNo("EMP"),
      createdAt: new Date().toISOString(),
    }),
  updateEmployee: (id: string, data: Partial<Employee>) => call<Employee>("update", "employees", id, data),
  removeEmployee: (id: string) => call<{ ok: true }>("remove", "employees", id),
  listPayroll: () => call<PayrollRun[]>("list", "payroll"),
  createPayroll: async (data: Omit<PayrollRun, "id" | "createdAt" | "net" | "status">) => {
    const net = data.basic + data.bonus + data.allowance - data.deduction;
    return call<PayrollRun>("create", "payroll", undefined, {
      ...data,
      net,
      status: "draft",
      createdAt: new Date().toISOString(),
    });
  },
  updatePayroll: async (id: string, data: Partial<Pick<PayrollRun, "bonus" | "allowance" | "deduction" | "basic" | "month">>) => {
    const run = await call<PayrollRun | null>("get", "payroll", id);
    if (!run) throw new Error("Payroll not found");
    if (run.status !== "draft") throw new Error("Only draft payslips can be edited");
    const basic = data.basic ?? run.basic;
    const bonus = data.bonus ?? run.bonus;
    const allowance = data.allowance ?? run.allowance;
    const deduction = data.deduction ?? run.deduction;
    return call<PayrollRun>("update", "payroll", id, {
      ...data,
      net: basic + bonus + allowance - deduction,
    });
  },
  removePayroll: async (id: string) => {
    const run = await call<PayrollRun | null>("get", "payroll", id);
    if (!run) throw new Error("Payroll not found");
    if (run.status !== "draft") throw new Error("Only draft payslips can be deleted");
    return call<{ ok: true }>("remove", "payroll", id);
  },
  payPayroll: async (id: string, method: PaymentMethod = "bank") => {
    const run = await call<PayrollRun | null>("get", "payroll", id);
    if (!run) throw new Error("Payroll not found");
    if (run.status === "paid") throw new Error("Already paid");
    const account = method === "cheque" || method === "mobile" ? "bank" : method;
    await postLedger({
      date: new Date().toISOString(),
      account,
      direction: "out",
      amount: run.net,
      category: "expense",
      refType: "payroll",
      refId: id,
      notes: `Salary ${run.employeeName} · ${run.month}`,
    });
    return call<PayrollRun>("update", "payroll", id, {
      status: "paid",
      paidAt: new Date().toISOString(),
      paymentMethod: method,
    });
  },
};
