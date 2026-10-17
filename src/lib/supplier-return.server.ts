import type {
  LineItem,
  Product,
  StockMovement,
  SupplierReturn,
} from "../types/index.ts";
import { getNextSequence } from "./document-sequence.ts";
import { resolveProductType, reconcileDatabaseInventory } from "./inventory.server.ts";
import { logAudit } from "./audit.ts";

const clean = <T>(doc: any): T => {
  if (!doc) return doc;
  const { _id, ...rest } = doc;
  return rest as T;
};

export async function listSupplierReturnsInDb(db: any): Promise<SupplierReturn[]> {
  const docs = await db
    .collection("supplierReturns")
    .find({})
    .sort({ createdAt: -1, date: -1 })
    .toArray();
  return docs.map((d: any) => clean<SupplierReturn>(d));
}

export async function getSupplierReturnByIdInDb(
  db: any,
  id: string,
): Promise<SupplierReturn | null> {
  const doc = await db.collection("supplierReturns").findOne({ id: String(id) });
  return clean<SupplierReturn | null>(doc);
}

export type CreateSupplierReturnPayload = {
  supplierId?: string;
  supplierName: string;
  date?: string;
  notes?: string;
  items: LineItem[];
};

export async function createSupplierReturnInDb(
  db: any,
  payload: CreateSupplierReturnPayload,
  user?: { username?: string },
): Promise<SupplierReturn> {
  if (!payload.items || payload.items.length === 0) {
    throw new Error("Add at least one item to return");
  }

  // 1. Validate sufficient stock for every returned item
  for (const item of payload.items) {
    const qty = Number(item.quantity) || 0;
    if (qty <= 0) {
      throw new Error(`Invalid return quantity for "${item.productName || item.productId}"`);
    }
    const pDoc = await db.collection("products").findOne({ id: item.productId });
    if (!pDoc) {
      throw new Error(`Product not found: "${item.productName || item.productId}"`);
    }
    const currentStock = Number(pDoc.stock) || 0;
    if (currentStock < qty) {
      throw new Error(
        `Insufficient stock for "${pDoc.name}". Available: ${currentStock}, Requested: ${qty}.`,
      );
    }
  }

  // 2. Generate sequence number & unique ID
  const returnNo = await getNextSequence(db, "SR");
  const returnId = Math.random().toString(36).slice(2, 10);
  const now = new Date().toISOString();
  const returnDate = payload.date || now;

  let subtotal = 0;

  // 3. Apply stock deduction and generate StockMovements
  for (const item of payload.items) {
    const qty = Number(item.quantity) || 0;
    const pDoc = await db.collection("products").findOne({ id: item.productId });
    const currentStock = Number(pDoc.stock) || 0;
    const nextStock = Math.max(0, currentStock - qty);
    const unitPrice = Number(item.price) || Number(pDoc.cost) || Number(pDoc.price) || 0;
    const lineTotal = qty * unitPrice;
    subtotal += lineTotal;

    // Deduct stock in products collection
    await db.collection("products").updateOne(
      { id: item.productId },
      { $set: { stock: nextStock } },
    );

    const pType = item.itemType || resolveProductType(pDoc);

    // Create outbound StockMovement
    const movement: StockMovement = {
      id: `sm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      date: returnDate,
      productId: item.productId,
      productName: item.productName || pDoc.name,
      productType: pType,
      type: "out",
      direction: "out",
      movementType: "PURCHASE_RETURN",
      quantity: qty,
      previousBalance: currentStock,
      balanceAfter: nextStock,
      newBalance: nextStock,
      unitCost: unitPrice,
      totalCost: lineTotal,
      cogsAmount: lineTotal,
      refType: "purchase",
      refId: returnId,
      notes: `Supplier Return ${returnNo} to ${payload.supplierName}`,
      by: user?.username || "system",
    };
    await db.collection("stockMovements").insertOne(movement);

    // Update separated inventory collections
    const costPrice = Number(pDoc.cost) || 0;
    const salesPrice = Number(pDoc.price) || 0;
    const valUnit = costPrice > 0 ? costPrice : salesPrice;

    if (pType === "gas") {
      await db.collection("gasInventory").updateOne(
        { productId: item.productId },
        {
          $inc: { stockOut: qty },
          $set: {
            onHand: nextStock,
            totalValue: nextStock * valUnit,
            updatedAt: now,
          },
        },
        { upsert: true },
      );
    } else if (pType === "cylinder") {
      const cylDoc = await db.collection("cylinderInventory").findOne({ productId: item.productId });
      const reserved = cylDoc ? Number(cylDoc.reserved) || 0 : 0;
      await db.collection("cylinderInventory").updateOne(
        { productId: item.productId },
        {
          $inc: { stockOut: qty },
          $set: {
            onHand: nextStock,
            available: Math.max(0, nextStock - reserved),
            totalValue: nextStock * valUnit,
            updatedAt: now,
          },
        },
        { upsert: true },
      );
    } else {
      await db.collection("productInventory").updateOne(
        { productId: item.productId },
        {
          $inc: { stockOut: qty },
          $set: {
            onHand: nextStock,
            totalValue: nextStock * valUnit,
            updatedAt: now,
          },
        },
        { upsert: true },
      );
    }
  }

  // 4. Create and save supplier return document
  const returnDoc: SupplierReturn = {
    id: returnId,
    returnNo,
    supplierId: payload.supplierId || "",
    supplierName: payload.supplierName,
    date: returnDate,
    items: payload.items,
    subtotal,
    tax: 0,
    total: subtotal,
    status: "confirmed",
    notes: payload.notes || "",
    createdAt: now,
  };

  await db.collection("supplierReturns").insertOne(returnDoc);

  // 5. Audit log
  try {
    await logAudit(db, {
      userId: user?.username || "system",
      username: user?.username || "system",
      action: "CREATE",
      entityType: "supplierReturns" as any,
      entityId: returnId,
      after: returnDoc as any,
      details: `Created supplier return ${returnNo} to ${payload.supplierName}`,
    });
  } catch {}

  // 6. Centralized inventory reconciliation
  await reconcileDatabaseInventory(db).catch(() => {});

  return clean<SupplierReturn>(returnDoc);
}

export async function updateSupplierReturnInDb(
  db: any,
  id: string,
  payload: Partial<CreateSupplierReturnPayload>,
  user?: { username?: string },
): Promise<SupplierReturn> {
  const existingDoc = await db.collection("supplierReturns").findOne({ id });
  if (!existingDoc) throw new Error("Supplier return not found");
  const existing: SupplierReturn = clean(existingDoc);

  if (existing.status === "cancelled") {
    throw new Error("Cancelled supplier returns cannot be edited");
  }

  const items = payload.items || existing.items;
  if (!items || items.length === 0) {
    throw new Error("Add at least one item to return");
  }

  // Find previous stock movements for this return
  const prevMovements = await db
    .collection("stockMovements")
    .find({ refId: id, movementType: "PURCHASE_RETURN" })
    .toArray();

  // Temporarily revert stock from previous movements to check availability
  for (const m of prevMovements) {
    await db.collection("products").updateOne(
      { id: m.productId },
      { $inc: { stock: m.quantity } },
    );
  }

  // Validate new items against available stock
  for (const item of items) {
    const qty = Number(item.quantity) || 0;
    if (qty <= 0) {
      // Revert temporary restore
      for (const m of prevMovements) {
        await db.collection("products").updateOne(
          { id: m.productId },
          { $inc: { stock: -m.quantity } },
        );
      }
      throw new Error(`Invalid return quantity for "${item.productName || item.productId}"`);
    }
    const pDoc = await db.collection("products").findOne({ id: item.productId });
    if (!pDoc) {
      for (const m of prevMovements) {
        await db.collection("products").updateOne(
          { id: m.productId },
          { $inc: { stock: -m.quantity } },
        );
      }
      throw new Error(`Product not found: "${item.productName || item.productId}"`);
    }
    const currentStock = Number(pDoc.stock) || 0;
    if (currentStock < qty) {
      // Revert temporary restore
      for (const m of prevMovements) {
        await db.collection("products").updateOne(
          { id: m.productId },
          { $inc: { stock: -m.quantity } },
        );
      }
      throw new Error(
        `Insufficient stock for "${pDoc.name}". Available: ${currentStock}, Requested: ${qty}.`,
      );
    }
  }

  // Stock is valid! Delete previous movements and apply new deductions
  await db.collection("stockMovements").deleteMany({ refId: id, movementType: "PURCHASE_RETURN" });

  const now = new Date().toISOString();
  const returnDate = payload.date || existing.date || now;
  let subtotal = 0;

  for (const item of items) {
    const qty = Number(item.quantity) || 0;
    const pDoc = await db.collection("products").findOne({ id: item.productId });
    const currentStock = Number(pDoc.stock) || 0;
    const nextStock = Math.max(0, currentStock - qty);
    const unitPrice = Number(item.price) || Number(pDoc.cost) || Number(pDoc.price) || 0;
    const lineTotal = qty * unitPrice;
    subtotal += lineTotal;

    await db.collection("products").updateOne(
      { id: item.productId },
      { $set: { stock: nextStock } },
    );

    const pType = item.itemType || resolveProductType(pDoc);

    const movement: StockMovement = {
      id: `sm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      date: returnDate,
      productId: item.productId,
      productName: item.productName || pDoc.name,
      productType: pType,
      type: "out",
      direction: "out",
      movementType: "PURCHASE_RETURN",
      quantity: qty,
      previousBalance: currentStock,
      balanceAfter: nextStock,
      newBalance: nextStock,
      unitCost: unitPrice,
      totalCost: lineTotal,
      cogsAmount: lineTotal,
      refType: "purchase",
      refId: id,
      notes: `Supplier Return ${existing.returnNo} to ${payload.supplierName || existing.supplierName}`,
      by: user?.username || "system",
    };
    await db.collection("stockMovements").insertOne(movement);
  }

  const updatedDoc: SupplierReturn = {
    ...existing,
    supplierId: payload.supplierId !== undefined ? payload.supplierId : existing.supplierId,
    supplierName: payload.supplierName || existing.supplierName,
    date: returnDate,
    items,
    subtotal,
    tax: 0,
    total: subtotal,
    notes: payload.notes !== undefined ? payload.notes : existing.notes,
    updatedAt: now,
  };

  await db.collection("supplierReturns").updateOne({ id }, { $set: updatedDoc });

  try {
    await logAudit(db, {
      userId: user?.username || "system",
      username: user?.username || "system",
      action: "UPDATE",
      entityType: "supplierReturns" as any,
      entityId: id,
      before: existing as any,
      after: updatedDoc as any,
      details: `Updated supplier return ${existing.returnNo}`,
    });
  } catch {}

  await reconcileDatabaseInventory(db).catch(() => {});

  return clean<SupplierReturn>(updatedDoc);
}

export async function removeSupplierReturnInDb(
  db: any,
  id: string,
  user?: { username?: string },
): Promise<{ ok: true }> {
  const existingDoc = await db.collection("supplierReturns").findOne({ id });
  if (!existingDoc) throw new Error("Supplier return not found");
  const existing: SupplierReturn = clean(existingDoc);

  // Revert stock adjustments
  const movements = await db
    .collection("stockMovements")
    .find({ refId: id, movementType: "PURCHASE_RETURN" })
    .toArray();

  for (const m of movements) {
    await db.collection("products").updateOne(
      { id: m.productId },
      { $inc: { stock: m.quantity } },
    );
  }

  await db.collection("stockMovements").deleteMany({ refId: id, movementType: "PURCHASE_RETURN" });
  await db.collection("supplierReturns").deleteOne({ id });

  try {
    await logAudit(db, {
      userId: user?.username || "system",
      username: user?.username || "system",
      action: "DELETE",
      entityType: "supplierReturns" as any,
      entityId: id,
      before: existing as any,
      details: `Deleted supplier return ${existing.returnNo}`,
    });
  } catch {}

  await reconcileDatabaseInventory(db).catch(() => {});

  return { ok: true };
}
