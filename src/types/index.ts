export type ID = string;

export interface Customer {
  id: ID;
  name: string;
  phone: string;
  email?: string;
  address: string;
  gstin?: string;
  openingBalance: number;
  createdAt: string;
}

export interface Supplier {
  id: ID;
  name: string;
  phone: string;
  email?: string;
  address: string;
  gstin?: string;
  openingBalance: number;
  createdAt: string;
}

export type ProductCategory = "LPG" | "Industrial" | "Medical" | "Other";
export type UnitOfMeasure = "kg" | "cyl" | "ltr" | "pcs";

export interface Product {
  id: ID;
  code: string;
  name: string;
  category: ProductCategory;
  uom: UnitOfMeasure;
  price: number;
  taxRate: number;
  stock: number;
  reorderLevel: number;
  createdAt: string;
}

export type CylinderStatus = "in_stock" | "at_customer" | "in_transit" | "refilling" | "damaged";

export interface Cylinder {
  id: ID;
  serialNumber: string;
  productId: ID;
  capacity: number;
  status: CylinderStatus;
  location: string;
  customerId?: ID;
  lastMovementAt: string;
  createdAt: string;
}

export type CylinderMovementType =
  | "received"
  | "issued"
  | "returned"
  | "refilled"
  | "transferred"
  | "damaged";

export interface CylinderMovement {
  id: ID;
  cylinderId: ID;
  type: CylinderMovementType;
  fromLocation?: string;
  toLocation?: string;
  customerId?: ID;
  notes?: string;
  timestamp: string;
  by: string;
}

export interface LineItem {
  productId: ID;
  productName: string;
  quantity: number;
  price: number;
  taxRate: number;
}

export type SalesStatus = "draft" | "confirmed" | "invoiced" | "paid" | "cancelled";

export interface SalesOrder {
  id: ID;
  orderNo: string;
  customerId: ID;
  customerName: string;
  date: string;
  items: LineItem[];
  subtotal: number;
  tax: number;
  total: number;
  paid: number;
  status: SalesStatus;
  notes?: string;
}

export interface Delivery {
  id: ID;
  challanNo: string;
  salesOrderId?: ID;
  customerId: ID;
  customerName: string;
  driverName: string;
  vehicleNo: string;
  items: LineItem[];
  status: "pending" | "confirmed" | "delivered";
  date: string;
  confirmedAt?: string;
}

export type PaymentMethod = "cash" | "bank";

export interface Expense {
  id: ID;
  date: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: PaymentMethod;
  createdAt: string;
}

export interface LedgerEntry {
  id: ID;
  date: string;
  account: PaymentMethod;
  direction: "in" | "out";
  amount: number;
  category: "opening" | "collection" | "expense" | "adjustment";
  refType?: "sales" | "expense";
  refId?: string;
  notes?: string;
}

export interface DashboardStats {
  todaySales: number;
  todayCollection: number;
  todayExpense: number;
  customerDue: number;
  supplierPayable: number;
  cashBalance: number;
  bankBalance: number;
}

export interface AuthUser {
  username: string;
  displayName: string;
}

export interface StockAlert {
  productId: ID;
  productName: string;
  stock: number;
  reorderLevel: number;
}
