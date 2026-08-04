import { z } from "zod";

export const customerSchema = z.object({
  name: z.string().min(2, "Name required"),
  phone: z.string().min(6, "Phone required"),
  email: z.union([z.literal(""), z.string().email()]).optional(),
  address: z.string().min(2, "Address required"),
  gstin: z.union([z.literal(""), z.string()]).optional(),
  openingBalance: z.coerce.number(),
});

export const supplierSchema = customerSchema;

export const productSchema = z.object({
  code: z.string().min(1, "Code required"),
  name: z.string().min(2, "Name required"),
  category: z.enum(["LPG", "Industrial", "Medical", "Other"]),
  uom: z.enum(["kg", "cyl", "ltr", "pcs"]),
  price: z.coerce.number().min(0),
  taxRate: z.coerce.number().min(0),
  stock: z.coerce.number().min(0),
  reorderLevel: z.coerce.number().min(0),
});

export const cylinderSchema = z.object({
  serialNumber: z.string().min(1),
  productId: z.string().min(1),
  capacity: z.coerce.number().min(0),
  status: z.enum(["in_stock", "at_customer", "in_transit", "refilling", "damaged", "lost"]),
  location: z.string().min(1),
  customerId: z.string().optional(),
});

export const lineItemSchema = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1),
  quantity: z.coerce.number().min(1),
  price: z.coerce.number().min(0),
  taxRate: z.coerce.number().min(0),
  cylinderIds: z.array(z.string()).optional(),
});

export const salesOrderSchema = z.object({
  customerId: z.string().min(1, "Select a customer"),
  notes: z.string().optional(),
  items: z.array(lineItemSchema).min(1, "Add at least one item"),
});

export const purchaseOrderSchema = z.object({
  supplierId: z.string().min(1, "Select a supplier"),
  notes: z.string().optional(),
  items: z.array(lineItemSchema).min(1, "Add at least one item"),
});

export const deliverySchema = z.object({
  customerId: z.string().min(1, "Select a customer"),
  salesOrderId: z.string().optional(),
  driverName: z.string().min(2, "Driver name required"),
  vehicleNo: z.string().min(2, "Vehicle number required"),
  items: z.array(lineItemSchema).min(1, "Add at least one item"),
});

export const employeeSchema = z.object({
  name: z.string().min(2, "Name required"),
  phone: z.string().min(6, "Phone required"),
  designation: z.string().min(2, "Designation required"),
  department: z.string().min(2, "Department required"),
  joiningDate: z.string().min(1, "Joining date required"),
  salary: z.coerce.number().min(0),
});

export const voucherSchema = z.object({
  type: z.enum(["payment", "receipt", "journal"]),
  account: z.string().min(1),
  amount: z.coerce.number().min(1),
  partyType: z.enum(["customer", "supplier"]).optional(),
  partyId: z.string().optional(),
  partyName: z.string().optional(),
  notes: z.string().optional(),
});
