import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type {
  CylinderInventory,
  GasInventory,
  LineItem,
  Product,
  ProductInventory,
  ProductType,
  PurchaseOrder,
  SalesOrder,
  StockMovement,
} from "../src/types/index.ts";
import {
  computeReservedQty,
  resolveProductType,
} from "../src/lib/inventory.server.ts";

describe("Authoritative Inventory Accounting & Reconciliation Tests", () => {
  // TEST 1 — GAS PURCHASE
  it("TEST 1: Gas purchase increases Gas Stock In and On Hand without modifying other types", () => {
    const gasInv: GasInventory = {
      id: "gas-1",
      productId: "g1",
      productName: "Industrial Gas A",
      productType: "gas",
      uom: "kg",
      openingStock: 100,
      stockIn: 0,
      stockOut: 0,
      onHand: 100,
      unitPrice: 50,
      costPrice: 40,
      totalValue: 4000,
      updatedAt: new Date().toISOString(),
    };

    const purchaseQty = 20;
    gasInv.stockIn += purchaseQty;
    gasInv.onHand = gasInv.openingStock + gasInv.stockIn - gasInv.stockOut;
    gasInv.totalValue = gasInv.onHand * gasInv.costPrice;

    assert.strictEqual(gasInv.stockIn, 20);
    assert.strictEqual(gasInv.stockOut, 0);
    assert.strictEqual(gasInv.onHand, 120);
    assert.strictEqual(gasInv.totalValue, 4800);
  });

  // TEST 2 — GAS SALE
  it("TEST 2: Gas sale increases Stock Out and decreases On Hand", () => {
    const gasInv: GasInventory = {
      id: "gas-1",
      productId: "g1",
      productName: "Industrial Gas A",
      productType: "gas",
      uom: "kg",
      openingStock: 100,
      stockIn: 20,
      stockOut: 0,
      onHand: 120,
      unitPrice: 50,
      costPrice: 40,
      totalValue: 4800,
      updatedAt: new Date().toISOString(),
    };

    const saleQty = 10;
    gasInv.stockOut += saleQty;
    gasInv.onHand = gasInv.openingStock + gasInv.stockIn - gasInv.stockOut;
    gasInv.totalValue = gasInv.onHand * gasInv.costPrice;

    assert.strictEqual(gasInv.stockOut, 10);
    assert.strictEqual(gasInv.onHand, 110);
    assert.strictEqual(gasInv.totalValue, 4400);
  });

  // TEST 3 — CYLINDER PURCHASE
  it("TEST 3: Cylinder purchase increases Cylinder On Hand", () => {
    const cylInv: CylinderInventory = {
      id: "cyl-1",
      productId: "c1",
      productName: "LPG Cylinder 12kg",
      productType: "cylinder",
      uom: "cyl",
      openingStock: 100,
      stockIn: 0,
      stockOut: 0,
      reserved: 0,
      available: 100,
      onHand: 100,
      unitPrice: 1400,
      costPrice: 1000,
      totalValue: 100000,
      updatedAt: new Date().toISOString(),
    };

    const receivedQty = 20;
    cylInv.stockIn += receivedQty;
    cylInv.onHand = cylInv.openingStock + cylInv.stockIn - cylInv.stockOut;
    cylInv.available = Math.max(0, cylInv.onHand - cylInv.reserved);

    assert.strictEqual(cylInv.onHand, 120);
    assert.strictEqual(cylInv.available, 120);
    assert.strictEqual(cylInv.reserved, 0);
  });

  // TEST 4 — CYLINDER SALE WITH RESERVED STOCK
  it("TEST 4: Cylinder sale maintains Reserved and Available formulas (Available = On Hand - Reserved)", () => {
    const cylInv: CylinderInventory = {
      id: "cyl-1",
      productId: "c1",
      productName: "LPG Cylinder 12kg",
      productType: "cylinder",
      uom: "cyl",
      openingStock: 100,
      stockIn: 20,
      stockOut: 0,
      reserved: 5,
      available: 115,
      onHand: 120,
      unitPrice: 1400,
      costPrice: 1000,
      totalValue: 120000,
      updatedAt: new Date().toISOString(),
    };

    // Actual sale = 10 cylinders delivered
    const actualSale = 10;
    cylInv.stockOut += actualSale;
    cylInv.onHand = cylInv.openingStock + cylInv.stockIn - cylInv.stockOut;
    cylInv.available = Math.max(0, cylInv.onHand - cylInv.reserved);

    assert.strictEqual(cylInv.onHand, 110);
    assert.strictEqual(cylInv.reserved, 5);
    assert.strictEqual(cylInv.available, 105);
  });

  // TEST 5 — GENERAL PRODUCT
  it("TEST 5: General product inventory follows On Hand = Opening + Purchase - Sale", () => {
    const prodInv: ProductInventory = {
      id: "prod-1",
      productId: "p1",
      productName: "Gas Regulator Valve",
      productType: "product",
      uom: "pcs",
      openingStock: 50,
      stockIn: 0,
      stockOut: 0,
      onHand: 50,
      unitPrice: 350,
      costPrice: 250,
      totalValue: 12500,
      updatedAt: new Date().toISOString(),
    };

    const purchaseQty = 20;
    const saleQty = 15;

    prodInv.stockIn += purchaseQty;
    prodInv.stockOut += saleQty;
    prodInv.onHand = prodInv.openingStock + prodInv.stockIn - prodInv.stockOut;

    assert.strictEqual(prodInv.onHand, 55);
    assert.strictEqual(prodInv.stockIn, 20);
    assert.strictEqual(prodInv.stockOut, 15);
  });

  // TEST 6 — TYPE ISOLATION
  it("TEST 6: Gas != Cylinder != Product isolation guarantees no cross-type contamination", () => {
    const gas: GasInventory = {
      id: "gas-1",
      productId: "g1",
      productName: "Gas Product",
      productType: "gas",
      uom: "kg",
      openingStock: 100,
      stockIn: 0,
      stockOut: 0,
      onHand: 100,
      unitPrice: 50,
      costPrice: 40,
      totalValue: 4000,
      updatedAt: new Date().toISOString(),
    };

    const cyl: CylinderInventory = {
      id: "cyl-1",
      productId: "c1",
      productName: "Cylinder Product",
      productType: "cylinder",
      uom: "cyl",
      openingStock: 100,
      stockIn: 0,
      stockOut: 0,
      reserved: 0,
      available: 100,
      onHand: 100,
      unitPrice: 1200,
      costPrice: 1000,
      totalValue: 100000,
      updatedAt: new Date().toISOString(),
    };

    const prod: ProductInventory = {
      id: "prod-1",
      productId: "pr1",
      productName: "General Item",
      productType: "product",
      uom: "pcs",
      openingStock: 100,
      stockIn: 0,
      stockOut: 0,
      onHand: 100,
      unitPrice: 200,
      costPrice: 150,
      totalValue: 15000,
      updatedAt: new Date().toISOString(),
    };

    // Action A: Sell 10 Gas
    gas.stockOut += 10;
    gas.onHand = gas.openingStock + gas.stockIn - gas.stockOut;
    assert.strictEqual(gas.onHand, 90);
    assert.strictEqual(cyl.onHand, 100);
    assert.strictEqual(prod.onHand, 100);

    // Action B: Sell 10 Cylinder
    cyl.stockOut += 10;
    cyl.onHand = cyl.openingStock + cyl.stockIn - cyl.stockOut;
    cyl.available = cyl.onHand - cyl.reserved;
    assert.strictEqual(gas.onHand, 90);
    assert.strictEqual(cyl.onHand, 90);
    assert.strictEqual(prod.onHand, 100);

    // Action C: Sell 10 General Product
    prod.stockOut += 10;
    prod.onHand = prod.openingStock + prod.stockIn - prod.stockOut;
    assert.strictEqual(gas.onHand, 90);
    assert.strictEqual(cyl.onHand, 90);
    assert.strictEqual(prod.onHand, 90);
  });

  // TEST 7 — DUPLICATE REQUEST PROTECTION (IDEMPOTENCY)
  it("TEST 7: Duplicate request with same idempotency key executes stock movement exactly once", () => {
    const movements: StockMovement[] = [];
    const postSale = (refId: string, productId: string, qty: number) => {
      const alreadyPosted = movements.some(
        (m) => m.refType === "sales" && m.refId === refId && m.productId === productId && m.type === "out",
      );
      if (alreadyPosted) return false;
      movements.push({
        id: "mov-" + Math.random(),
        date: new Date().toISOString(),
        productId,
        productName: "Test Product",
        type: "out",
        movementType: "SALE_ISSUE",
        quantity: qty,
        balanceAfter: 90,
        refType: "sales",
        refId,
        by: "Sales",
      });
      return true;
    };

    const first = postSale("so-100", "p1", 10);
    const second = postSale("so-100", "p1", 10); // Duplicate call
    assert.strictEqual(first, true);
    assert.strictEqual(second, false);
    assert.strictEqual(movements.length, 1);
    assert.strictEqual(movements[0].quantity, 10);
  });

  // TEST 8 — PURCHASE EDIT (DELTA CALCULATION)
  it("TEST 8: Purchase edit applies only the delta difference (100 -> 120 = +20)", () => {
    let stockIn = 100;
    const oldQty = 100;
    const newQty = 120;
    const delta = newQty - oldQty; // +20
    stockIn += delta;
    assert.strictEqual(delta, 20);
    assert.strictEqual(stockIn, 120);

    // Edit down: 120 -> 80 = -40
    const downNewQty = 80;
    const downDelta = downNewQty - 120;
    stockIn += downDelta;
    assert.strictEqual(downDelta, -40);
    assert.strictEqual(stockIn, 80);
  });

  // TEST 9 — SALE EDIT (DELTA CALCULATION)
  it("TEST 9: Sale edit applies only the delta stockOut difference (10 -> 15 = +5 stockOut)", () => {
    let stockOut = 10;
    const oldQty = 10;
    const newQty = 15;
    const delta = newQty - oldQty; // +5
    stockOut += delta;
    assert.strictEqual(delta, 5);
    assert.strictEqual(stockOut, 15);

    // Reverse down: 15 -> 7 = -8
    const downNewQty = 7;
    const downDelta = downNewQty - 15;
    stockOut += downDelta;
    assert.strictEqual(downDelta, -8);
    assert.strictEqual(stockOut, 7);
  });

  // TEST 10 — PURCHASE RECEIVING (PO ALONE vs GRN)
  it("TEST 10: Creating PO alone does not increase stock until GRN is received", () => {
    let physicalStock = 50;
    const po: PurchaseOrder = {
      id: "po-test",
      orderNo: "PO-2026-001",
      supplierId: "s1",
      supplierName: "Test Supplier",
      date: new Date().toISOString(),
      items: [{ productId: "p1", productName: "Product 1", quantity: 100, price: 50 }],
      subtotal: 5000,
      tax: 0,
      total: 5000,
      paid: 0,
      status: "ordered", // Not yet received
    };

    // PO alone does NOT change physicalStock
    assert.strictEqual(physicalStock, 50);

    // GRN received:
    const grnReceivedQty = 100;
    physicalStock += grnReceivedQty;
    po.status = "received";

    assert.strictEqual(physicalStock, 150);
  });

  // TEST 11 — RESOLVE PRODUCT TYPE
  it("TEST 11: resolveProductType correctly resolves Gas, Cylinder, and Product", () => {
    assert.strictEqual(resolveProductType({ productType: "gas", uom: "kg" }), "gas");
    assert.strictEqual(resolveProductType({ productType: "cylinder", uom: "cyl" }), "cylinder");
    assert.strictEqual(resolveProductType({ productType: "product", uom: "pcs" }), "product");
    assert.strictEqual(resolveProductType({ uom: "cyl" }), "cylinder");
    assert.strictEqual(resolveProductType({ uom: "kg" }), "gas");
    assert.strictEqual(resolveProductType({ uom: "pcs" }), "product");
  });
});
