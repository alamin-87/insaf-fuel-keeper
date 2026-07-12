import type {
  Customer, Supplier, Product, Cylinder, CylinderMovement, SalesOrder, Delivery,
  Expense, LedgerEntry,
} from "@/types";

const iso = (d: Date) => d.toISOString();
const today = new Date();
const daysAgo = (n: number) => iso(new Date(today.getTime() - n * 86400000));

export const seedCustomers: Customer[] = [
  { id: "c1", name: "Padma Steel Mills Ltd", phone: "+880 1711 111111", email: "orders@padmasteel.bd", address: "BSCIC Industrial Area, Narayanganj", gstin: "BIN-102345678-0101", openingBalance: 148000, createdAt: daysAgo(120) },
  { id: "c2", name: "Square Hospital", phone: "+880 1712 222222", email: "purchase@squarehospital.bd", address: "18/F West Panthapath, Dhaka", gstin: "BIN-100987654-0202", openingBalance: 42500, createdAt: daysAgo(90) },
  { id: "c3", name: "Star Kabab & Restaurant", phone: "+880 1713 333333", address: "Dhanmondi 27, Dhaka", openingBalance: 8500, createdAt: daysAgo(60) },
  { id: "c4", name: "Cooper's Bakery", phone: "+880 1714 444444", address: "Gulshan Avenue, Dhaka", openingBalance: 0, createdAt: daysAgo(45) },
  { id: "c5", name: "Rahim Afrooz Industries", phone: "+880 1715 555555", email: "gas@rahimafrooz.bd", address: "Tejgaon I/A, Dhaka", gstin: "BIN-100555555-0303", openingBalance: 92000, createdAt: daysAgo(30) },
  { id: "c6", name: "Chittagong Port Canteen", phone: "+880 1716 666666", address: "Bandar, Chattogram", openingBalance: 4200, createdAt: daysAgo(20) },
];

export const seedSuppliers: Supplier[] = [
  { id: "s1", name: "Bashundhara LP Gas Ltd", phone: "+880 2 8402385", address: "Bashundhara R/A, Dhaka", gstin: "BIN-100111222-0001", openingBalance: 580000, createdAt: daysAgo(180) },
  { id: "s2", name: "Omera Petroleum Ltd", phone: "+880 2 9887610", address: "Mohakhali C/A, Dhaka", gstin: "BIN-100333444-0002", openingBalance: 320000, createdAt: daysAgo(150) },
  { id: "s3", name: "Linde Bangladesh Ltd", phone: "+880 2 9887111", address: "Tejgaon, Dhaka", gstin: "BIN-100555666-0003", openingBalance: 145000, createdAt: daysAgo(100) },
];

export const seedProducts: Product[] = [
  { id: "p1", code: "LPG-12", name: "LPG Domestic 12kg", category: "LPG", uom: "cyl", price: 1450, taxRate: 5, stock: 65, reorderLevel: 25, createdAt: daysAgo(120) },
  { id: "p2", code: "LPG-35", name: "LPG Commercial 35kg", category: "LPG", uom: "cyl", price: 4200, taxRate: 5, stock: 12, reorderLevel: 15, createdAt: daysAgo(120) },
  { id: "p3", code: "LPG-45", name: "LPG Commercial 45kg", category: "LPG", uom: "cyl", price: 5350, taxRate: 5, stock: 28, reorderLevel: 12, createdAt: daysAgo(120) },
  { id: "p4", code: "OXY-D", name: "Medical Oxygen D-Type", category: "Medical", uom: "cyl", price: 850, taxRate: 12, stock: 34, reorderLevel: 15, createdAt: daysAgo(120) },
  { id: "p5", code: "N2-B", name: "Nitrogen Industrial", category: "Industrial", uom: "cyl", price: 1150, taxRate: 15, stock: 6, reorderLevel: 10, createdAt: daysAgo(120) },
  { id: "p6", code: "CO2-B", name: "Carbon Dioxide", category: "Industrial", uom: "cyl", price: 980, taxRate: 15, stock: 22, reorderLevel: 10, createdAt: daysAgo(120) },
];

export const seedCylinders: Cylinder[] = [
  { id: "cy1", serialNumber: "INS-BD-00001", productId: "p1", capacity: 12, status: "in_stock", location: "Warehouse Dhaka-A", lastMovementAt: daysAgo(2), createdAt: daysAgo(200) },
  { id: "cy2", serialNumber: "INS-BD-00002", productId: "p2", capacity: 35, status: "at_customer", location: "Padma Steel Mills", customerId: "c1", lastMovementAt: daysAgo(4), createdAt: daysAgo(200) },
  { id: "cy3", serialNumber: "INS-BD-00003", productId: "p4", capacity: 7, status: "in_transit", location: "Van DHK-METRO-GA-1122", lastMovementAt: daysAgo(1), createdAt: daysAgo(200) },
  { id: "cy4", serialNumber: "INS-BD-00004", productId: "p1", capacity: 12, status: "refilling", location: "Bashundhara Plant", lastMovementAt: daysAgo(3), createdAt: daysAgo(200) },
  { id: "cy5", serialNumber: "INS-BD-00005", productId: "p5", capacity: 10, status: "in_stock", location: "Warehouse Dhaka-B", lastMovementAt: daysAgo(6), createdAt: daysAgo(200) },
  { id: "cy6", serialNumber: "INS-BD-00006", productId: "p4", capacity: 7, status: "at_customer", location: "Square Hospital", customerId: "c2", lastMovementAt: daysAgo(5), createdAt: daysAgo(200) },
];

export const seedMovements: CylinderMovement[] = [
  { id: "m1", cylinderId: "cy2", type: "issued", fromLocation: "Warehouse Dhaka-A", toLocation: "Padma Steel Mills", customerId: "c1", timestamp: daysAgo(4), by: "Karim Uddin" },
  { id: "m2", cylinderId: "cy3", type: "issued", fromLocation: "Warehouse Dhaka-A", toLocation: "Van DHK-METRO-GA-1122", timestamp: daysAgo(1), by: "Karim Uddin" },
  { id: "m3", cylinderId: "cy4", type: "returned", fromLocation: "Cooper's Bakery", toLocation: "Bashundhara Plant", timestamp: daysAgo(3), by: "Jahangir Alam" },
  { id: "m4", cylinderId: "cy6", type: "issued", fromLocation: "Warehouse Dhaka-A", toLocation: "Square Hospital", customerId: "c2", timestamp: daysAgo(5), by: "Karim Uddin" },
];

export const seedSales: SalesOrder[] = [
  {
    id: "so1", orderNo: "SO-2026-0001", customerId: "c1", customerName: "Padma Steel Mills Ltd",
    date: daysAgo(0), items: [{ productId: "p2", productName: "LPG Commercial 35kg", quantity: 8, price: 4200, taxRate: 5 }],
    subtotal: 33600, tax: 1680, total: 35280, paid: 35280, status: "paid",
  },
  {
    id: "so2", orderNo: "SO-2026-0002", customerId: "c2", customerName: "Square Hospital",
    date: daysAgo(0), items: [{ productId: "p4", productName: "Medical Oxygen D-Type", quantity: 12, price: 850, taxRate: 12 }],
    subtotal: 10200, tax: 1224, total: 11424, paid: 0, status: "invoiced",
  },
  {
    id: "so3", orderNo: "SO-2026-0003", customerId: "c5", customerName: "Rahim Afrooz Industries",
    date: daysAgo(0), items: [{ productId: "p5", productName: "Nitrogen Industrial", quantity: 4, price: 1150, taxRate: 15 }],
    subtotal: 4600, tax: 690, total: 5290, paid: 5290, status: "paid",
  },
  {
    id: "so4", orderNo: "SO-2026-0004", customerId: "c3", customerName: "Star Kabab & Restaurant",
    date: daysAgo(0), items: [{ productId: "p1", productName: "LPG Domestic 12kg", quantity: 6, price: 1450, taxRate: 5 }],
    subtotal: 8700, tax: 435, total: 9135, paid: 0, status: "confirmed",
  },
  {
    id: "so5", orderNo: "SO-2026-0005", customerId: "c4", customerName: "Cooper's Bakery",
    date: daysAgo(1), items: [{ productId: "p3", productName: "LPG Commercial 45kg", quantity: 3, price: 5350, taxRate: 5 }],
    subtotal: 16050, tax: 802, total: 16852, paid: 0, status: "draft",
  },
];

export const seedDeliveries: Delivery[] = [
  {
    id: "d1", challanNo: "DC-2026-0001", salesOrderId: "so2", customerId: "c2", customerName: "Square Hospital",
    driverName: "Jahangir Alam", vehicleNo: "DHK-METRO-GA-1122",
    items: [{ productId: "p4", productName: "Medical Oxygen D-Type", quantity: 12, price: 850, taxRate: 12 }],
    status: "pending", date: daysAgo(0),
  },
  {
    id: "d2", challanNo: "DC-2026-0002", salesOrderId: "so4", customerId: "c3", customerName: "Star Kabab & Restaurant",
    driverName: "Karim Uddin", vehicleNo: "DHK-METRO-CHA-3344",
    items: [{ productId: "p1", productName: "LPG Domestic 12kg", quantity: 6, price: 1450, taxRate: 5 }],
    status: "confirmed", date: daysAgo(0), confirmedAt: daysAgo(0),
  },
];

export const seedExpenses: Expense[] = [
  { id: "e1", date: daysAgo(0), category: "Transport", description: "Delivery van fuel — Dhaka routes", amount: 4200, paymentMethod: "cash", createdAt: daysAgo(0) },
  { id: "e2", date: daysAgo(0), category: "Utilities", description: "Warehouse electricity bill", amount: 8500, paymentMethod: "bank", createdAt: daysAgo(0) },
  { id: "e3", date: daysAgo(1), category: "Maintenance", description: "Cylinder valve kit", amount: 3200, paymentMethod: "cash", createdAt: daysAgo(1) },
  { id: "e4", date: daysAgo(2), category: "Salaries", description: "Driver advance — Karim Uddin", amount: 5000, paymentMethod: "cash", createdAt: daysAgo(2) },
];

export const seedLedger: LedgerEntry[] = [
  { id: "l0", date: daysAgo(30), account: "cash", direction: "in", amount: 150000, category: "opening", notes: "Opening cash float" },
  { id: "l1", date: daysAgo(30), account: "bank", direction: "in", amount: 850000, category: "opening", notes: "Opening bank balance" },
  { id: "l2", date: daysAgo(0), account: "cash", direction: "in", amount: 35280, category: "collection", refType: "sales", refId: "so1", notes: "SO-2026-0001" },
  { id: "l3", date: daysAgo(0), account: "bank", direction: "in", amount: 5290, category: "collection", refType: "sales", refId: "so3", notes: "SO-2026-0003" },
  { id: "l4", date: daysAgo(0), account: "cash", direction: "out", amount: 4200, category: "expense", refType: "expense", refId: "e1", notes: "Delivery van fuel" },
  { id: "l5", date: daysAgo(0), account: "bank", direction: "out", amount: 8500, category: "expense", refType: "expense", refId: "e2", notes: "Warehouse electricity" },
  { id: "l6", date: daysAgo(1), account: "cash", direction: "out", amount: 3200, category: "expense", refType: "expense", refId: "e3", notes: "Cylinder valve kit" },
  { id: "l7", date: daysAgo(2), account: "cash", direction: "out", amount: 5000, category: "expense", refType: "expense", refId: "e4", notes: "Driver advance" },
];

export const allSeed = {
  customers: seedCustomers,
  suppliers: seedSuppliers,
  products: seedProducts,
  cylinders: seedCylinders,
  movements: seedMovements,
  sales: seedSales,
  deliveries: seedDeliveries,
  expenses: seedExpenses,
  ledger: seedLedger,
};
