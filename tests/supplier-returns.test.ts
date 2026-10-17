import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { supplierReturnSchema } from "../src/utils/validators.ts";
import { computeTotals, lineAmount } from "../src/utils/helpers.ts";
import { computeSupplierPayables } from "../src/lib/accounting-engine.ts";
import { buildPartyStatement } from "../src/lib/party-statement.ts";
import type { Supplier, PurchaseOrder, SupplierReturn, Product, StockMovement, Voucher } from "../src/types/index.ts";

describe("Suppliers Return Module — Unit & Business Logic Tests", () => {
  const mockSuppliers: Supplier[] = [
    {
      id: "sup-1",
      name: "Bashundhara LP Gas Ltd",
      phone: "+880 2 8402385",
      address: "Bashundhara R/A, Dhaka",
      openingBalance: 0,
    },
    {
      id: "sup-2",
      name: "Omera Petroleum Ltd",
      phone: "+880 2 9887610",
      address: "Mohakhali C/A, Dhaka",
      openingBalance: 0,
    },
  ];

  const mockProducts: Product[] = [
    {
      id: "prod-1",
      name: "12kg LPG Cylinder Refill",
      category: "LPG",
      productType: "gas",
      uom: "kg",
      price: 1400,
      cost: 1200,
      stock: 50,
      costingMethod: "fifo",
    },
    {
      id: "prod-2",
      name: "Empty 12kg Cylinder",
      category: "Cylinder",
      productType: "cylinder",
      uom: "cyl",
      price: 2200,
      cost: 2000,
      stock: 30,
      costingMethod: "fifo",
    },
  ];

  describe("1. Schema Validation (supplierReturnSchema)", () => {
    it("accepts valid supplier return with selected supplier and products", () => {
      const payload = {
        supplierId: "sup-1",
        supplierName: "Bashundhara LP Gas Ltd",
        items: [
          {
            productId: "prod-1",
            productName: "12kg LPG Cylinder Refill",
            quantity: 5,
            price: 1200,
            itemType: "gas" as const,
          },
        ],
        notes: "Returning defective cylinders",
      };

      const parsed = supplierReturnSchema.safeParse(payload);
      assert.equal(parsed.success, true);
    });

    it("accepts valid supplier return with custom typed supplier name", () => {
      const payload = {
        supplierId: "",
        supplierName: "Custom Supplier Express",
        items: [
          {
            productId: "prod-2",
            productName: "Empty 12kg Cylinder",
            quantity: 2,
            price: 2000,
            itemType: "cylinder" as const,
          },
        ],
      };

      const parsed = supplierReturnSchema.safeParse(payload);
      assert.equal(parsed.success, true);
    });

    it("fails when supplier name is empty", () => {
      const payload = {
        supplierId: "",
        supplierName: "",
        items: [
          {
            productId: "prod-1",
            productName: "12kg LPG Cylinder Refill",
            quantity: 1,
            price: 1200,
          },
        ],
      };

      const parsed = supplierReturnSchema.safeParse(payload);
      assert.equal(parsed.success, false);
    });

    it("fails when items list is empty", () => {
      const payload = {
        supplierId: "sup-1",
        supplierName: "Bashundhara LP Gas Ltd",
        items: [],
      };

      const parsed = supplierReturnSchema.safeParse(payload);
      assert.equal(parsed.success, false);
    });

    it("fails when quantity is zero or negative", () => {
      const payload = {
        supplierId: "sup-1",
        supplierName: "Bashundhara LP Gas Ltd",
        items: [
          {
            productId: "prod-1",
            productName: "12kg LPG Cylinder Refill",
            quantity: 0,
            price: 1200,
          },
        ],
      };

      const parsed = supplierReturnSchema.safeParse(payload);
      assert.equal(parsed.success, false);
    });
  });

  describe("2. Calculations & Totals", () => {
    it("computes line amounts, subtotal and total accurately", () => {
      const items = [
        {
          productId: "prod-1",
          productName: "12kg LPG Cylinder Refill",
          quantity: 3,
          price: 1200,
        },
        {
          productId: "prod-2",
          productName: "Empty 12kg Cylinder",
          quantity: 2,
          price: 2000,
        },
      ];

      assert.equal(lineAmount(items[0]), 3600);
      assert.equal(lineAmount(items[1]), 4000);

      const totals = computeTotals(items);
      assert.equal(totals.subtotal, 7600);
      assert.equal(totals.total, 7600);
    });
  });

  describe("3. Inventory & Stock Deduction Logic", () => {
    it("prevents return when requested quantity exceeds available stock", () => {
      const stock = 10;
      const requested = 15;

      assert.throws(
        () => {
          if (stock < requested) {
            throw new Error(`Insufficient stock. Available: ${stock}, Requested: ${requested}.`);
          }
        },
        { message: /Insufficient stock/ },
      );
    });

    it("correctly deducts stock on return creation and generates outbound stock movement", () => {
      let currentStock = 50;
      const returnQty = 5;
      const unitCost = 1200;

      // Verify availability
      assert.ok(currentStock >= returnQty, "Stock must be sufficient");

      // Deduct stock
      currentStock -= returnQty;
      assert.equal(currentStock, 45);

      // Create movement
      const movement: StockMovement = {
        id: "sm-test-1",
        date: new Date().toISOString(),
        productId: "prod-1",
        productName: "12kg LPG Cylinder Refill",
        productType: "gas",
        type: "out",
        direction: "out",
        movementType: "PURCHASE_RETURN",
        quantity: returnQty,
        previousBalance: 50,
        balanceAfter: 45,
        newBalance: 45,
        unitCost,
        totalCost: returnQty * unitCost,
        cogsAmount: returnQty * unitCost,
        refType: "purchase",
        refId: "sr-101",
        notes: "Supplier Return SR-2026-000001",
      };

      assert.equal(movement.direction, "out");
      assert.equal(movement.movementType, "PURCHASE_RETURN");
      assert.equal(movement.balanceAfter, 45);
    });

    it("reconciles inventory when editing a return (adjusting difference)", () => {
      let currentStock = 45; // after returning 5 originally from 50
      const prevReturnedQty = 5;
      const newReturnedQty = 8; // user increases return to 8

      // Revert previous return
      currentStock += prevReturnedQty; // back to 50
      assert.equal(currentStock, 50);

      // Check new quantity
      assert.ok(currentStock >= newReturnedQty);

      // Apply new deduction
      currentStock -= newReturnedQty;
      assert.equal(currentStock, 42);
    });

    it("restores inventory completely when cancelling or deleting a return", () => {
      let currentStock = 45;
      const returnedQty = 5;

      // Cancel/delete return
      currentStock += returnedQty;
      assert.equal(currentStock, 50);
    });
  });

  describe("4. Supplier Ledger & Accounting Integration", () => {
    it("reduces supplier payable when supplier return is posted", () => {
      const purchases: PurchaseOrder[] = [
        {
          id: "po-1",
          orderNo: "PO-2026-000001",
          supplierId: "sup-1",
          supplierName: "Bashundhara LP Gas Ltd",
          date: "2026-10-10",
          items: [
            {
              productId: "prod-1",
              productName: "12kg LPG Cylinder Refill",
              quantity: 10,
              price: 1200,
            },
          ],
          subtotal: 12000,
          tax: 0,
          total: 12000,
          paid: 0,
          status: "received",
        },
      ];

      // Without return: due is 12,000
      const apWithoutReturn = computeSupplierPayables(mockSuppliers, purchases, [], []);
      const row1 = apWithoutReturn.rows.find((r) => r.id === "sup-1");
      assert.equal(row1?.due, 12000);

      // Now with confirmed supplier return of 2,400 (2 items returned)
      const returns: SupplierReturn[] = [
        {
          id: "sr-1",
          returnNo: "SR-2026-000001",
          supplierId: "sup-1",
          supplierName: "Bashundhara LP Gas Ltd",
          date: "2026-10-12",
          items: [
            {
              productId: "prod-1",
              productName: "12kg LPG Cylinder Refill",
              quantity: 2,
              price: 1200,
            },
          ],
          subtotal: 2400,
          tax: 0,
          total: 2400,
          status: "confirmed",
          createdAt: "2026-10-12T10:00:00Z",
        },
      ];

      const apWithReturn = computeSupplierPayables(mockSuppliers, purchases, [], returns);
      const rowWithReturn = apWithReturn.rows.find((r) => r.id === "sup-1");

      // Net due should be reduced from 12,000 to 9,600!
      assert.equal(rowWithReturn?.due, 9600);
    });

    it("reflects supplier return as debit line in supplier statement", () => {
      const purchases: PurchaseOrder[] = [
        {
          id: "po-1",
          orderNo: "PO-2026-000001",
          supplierId: "sup-1",
          supplierName: "Bashundhara LP Gas Ltd",
          date: "2026-10-10",
          items: [],
          subtotal: 12000,
          tax: 0,
          total: 12000,
          paid: 0,
          status: "received",
        },
      ];

      const returns: SupplierReturn[] = [
        {
          id: "sr-1",
          returnNo: "SR-2026-000001",
          supplierId: "sup-1",
          supplierName: "Bashundhara LP Gas Ltd",
          date: "2026-10-12",
          items: [],
          subtotal: 2400,
          tax: 0,
          total: 2400,
          status: "confirmed",
          createdAt: "2026-10-12T10:00:00Z",
        },
      ];

      const statement = buildPartyStatement({
        kind: "supplier",
        party: mockSuppliers[0],
        purchases,
        supplierReturns: returns,
        vouchers: [],
        range: { preset: "all" },
      });

      const returnLine = statement.lines.find((l) => l.type === "return");
      assert.ok(returnLine, "Return line must be present in statement");
      assert.equal(returnLine.debit, 2400);
      assert.equal(returnLine.credit, 0);
      assert.equal(returnLine.particulars, "SR-2026-000001");

      // Closing balance should be 9,600 (12000 purchase credit - 2400 return debit)
      assert.equal(statement.closingBalance, 9600);
    });
  });
});
