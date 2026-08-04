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
  cost?: number;
  taxRate: number;
  stock: number;
  reorderLevel: number;
  createdAt: string;
}

export type CylinderStatus = "in_stock" | "at_customer" | "in_transit" | "refilling" | "damaged" | "lost";

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
  | "damaged"
  | "lost";

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
  cylinderIds?: string[];
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
  status: "pending" | "confirmed" | "delivered" | "in_transit" | "returned";
  date: string;
  confirmedAt?: string;
}

export type PurchaseStatus = "draft" | "ordered" | "received" | "billed" | "paid" | "cancelled";

export interface PurchaseOrder {
  id: ID;
  orderNo: string;
  supplierId: ID;
  supplierName: string;
  date: string;
  items: LineItem[];
  subtotal: number;
  tax: number;
  total: number;
  paid: number;
  status: PurchaseStatus;
  grnNo?: string;
  receivedAt?: string;
  notes?: string;
}

export type StockMovementType = "in" | "out" | "adjust" | "return";

export interface StockMovement {
  id: ID;
  date: string;
  productId: ID;
  productName: string;
  type: StockMovementType;
  quantity: number;
  balanceAfter: number;
  refType?: "sales" | "purchase" | "delivery" | "adjustment";
  refId?: string;
  notes?: string;
  by: string;
}

export type PaymentMethod = "cash" | "bank" | "cheque" | "mobile" | (string & {});

export interface Account {
  id: ID;
  name: string;
  type: "bank" | "mobile" | "cash";
  accountNo?: string;
  bankName?: string;
  createdAt: string;
}

export type CoaType = "Asset" | "Liability" | "Equity" | "Income" | "Expense";

export interface ChartOfAccount {
  id: ID;
  name: string;
  type: CoaType;
  code?: string;
  createdAt: string;
}

export interface BusinessAsset {
  id: ID;
  name: string;
  category: string;
  purchaseDate: string;
  purchaseCost: number;
  currentValue: number;
  notes?: string;
  createdAt: string;
}

export interface Expense {
  id: ID;
  date: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: PaymentMethod;
  createdAt: string;
}

export type LedgerCategory =
  | "opening"
  | "collection"
  | "expense"
  | "adjustment"
  | "purchase"
  | "receipt"
  | "payment"
  | "journal";

export interface LedgerEntry {
  id: ID;
  date: string;
  account: PaymentMethod;
  direction: "in" | "out";
  amount: number;
  category: LedgerCategory;
  refType?: "sales" | "expense" | "purchase" | "voucher" | "payroll";
  refId?: string;
  notes?: string;
}

export type VoucherType = "payment" | "receipt" | "journal";

export interface Voucher {
  id: ID;
  voucherNo: string;
  type: VoucherType;
  date: string;
  account: PaymentMethod;
  amount: number;
  partyType?: "customer" | "supplier";
  partyId?: string;
  partyName?: string;
  drAccount?: string;
  crAccount?: string;
  notes?: string;
  createdAt: string;
}

export interface Employee {
  id: ID;
  employeeNo: string;
  name: string;
  phone: string;
  designation: string;
  department: string;
  joiningDate: string;
  salary: number;
  status: "active" | "inactive";
  createdAt: string;
}

export interface PayrollRun {
  id: ID;
  employeeId: ID;
  employeeName: string;
  month: string;
  basic: number;
  bonus: number;
  allowance: number;
  deduction: number;
  net: number;
  status: "draft" | "paid";
  paidAt?: string;
  paymentMethod?: PaymentMethod;
  createdAt: string;
}

export interface DashboardStats {
  todaySales: number;
  todayCollection: number;
  todayExpense: number;
  customerDue: number;
  supplierPayable: number;
  cashBalance: number;
  bankBalance: number;
  availableStock: number;
  cylindersInWarehouse: number;
  cylindersWithCustomers: number;
  cylindersUnderRefill: number;
  damagedCylinders: number;
  lostCylinders: number;
  monthlySales: number;
}

export interface AuthUser {
  username: string;
  displayName: string;
  role?: string;
}

export interface StockAlert {
  productId: ID;
  productName: string;
  stock: number;
  reorderLevel: number;
}
