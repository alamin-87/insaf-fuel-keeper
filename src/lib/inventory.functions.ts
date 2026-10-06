import { createServerFn } from "@tanstack/react-start";
import { requireUser } from "./session.server";
import { getDb, getMongoClient } from "./mongo.server";
import {
  reconcileDatabaseInventory,
  resolveProductType,
} from "./inventory.server";
import type {
  CylinderInventory,
  GasInventory,
  InventorySummary,
  ProductInventory,
} from "@/types";

const clean = <T>(doc: any): T => {
  if (!doc) return doc;
  const { _id, ...rest } = doc;
  return rest as T;
};

export const getGasInventoryFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<GasInventory[]> => {
    await requireUser();
    const db = await getDb();
    await reconcileDatabaseInventory(db);
    const docs = await db.collection("gasInventory").find({}).toArray();
    return docs.map((d: any) => clean<GasInventory>(d));
  },
);

export const getCylinderInventoryFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<CylinderInventory[]> => {
    await requireUser();
    const db = await getDb();
    await reconcileDatabaseInventory(db);
    const docs = await db.collection("cylinderInventory").find({}).toArray();
    return docs.map((d: any) => clean<CylinderInventory>(d));
  },
);

export const getProductInventoryFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<ProductInventory[]> => {
    await requireUser();
    const db = await getDb();
    await reconcileDatabaseInventory(db);
    const docs = await db.collection("productInventory").find({}).toArray();
    return docs.map((d: any) => clean<ProductInventory>(d));
  },
);

export const getInventorySummaryFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<InventorySummary> => {
    await requireUser();
    const db = await getDb();
    return reconcileDatabaseInventory(db);
  },
);

export const reconcileInventoryDbFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<InventorySummary> => {
    const user = await requireUser();
    const db = await getDb();
    const summary = await reconcileDatabaseInventory(db);
    return summary;
  },
);
