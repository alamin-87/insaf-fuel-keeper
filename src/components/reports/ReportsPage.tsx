import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { salesService } from "@/services/sales.service";
import { purchaseService } from "@/services/purchase.service";
import { productService } from "@/services/product.service";
import { cylinderService } from "@/services/cylinder.service";
import { expenseService } from "@/services/expense.service";
import { accountingService } from "@/services/accounting.service";
import { deliveryService } from "@/services/delivery.service";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { DateRangeFilter } from "@/components/common/DateRangeFilter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { useT } from "@/i18n";
import { EMPTY_DATE_RANGE, filterByDateRange, type DateRange } from "@/lib/date-range";

const reports = [
  { id: "sales", key: "reports.sales" }, { id: "purchase", key: "reports.purchase" },
  { id: "stock", key: "reports.stock" }, { id: "cylinder", key: "reports.cylinder" },
  { id: "ar", key: "reports.ar" }, { id: "ap", key: "reports.ap" },
  { id: "cash", key: "reports.cash" }, { id: "bank", key: "reports.bank" },
  { id: "expense", key: "reports.expense" }, { id: "delivery", key: "reports.delivery" },
  { id: "product", key: "reports.product" },
] as const;

type ReportId = (typeof reports)[number]["id"];

export function ReportsPage() {
  const t = useT();
  const [active, setActive] = useState<ReportId>("sales");
  const [range, setRange] = useState<DateRange>(EMPTY_DATE_RANGE);
  const { data: salesRaw = [] } = useQuery({ queryKey: ["sales"], queryFn: salesService.list });
  const { data: purchasesRaw = [] } = useQuery({ queryKey: ["purchases"], queryFn: purchaseService.list });
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: productService.list });
  const { data: cylinders = [] } = useQuery({ queryKey: ["cylinders"], queryFn: cylinderService.list });
  const { data: expensesRaw = [] } = useQuery({ queryKey: ["expenses"], queryFn: expenseService.list });
  const { data: ledgerRaw = [] } = useQuery({ queryKey: ["ledger"], queryFn: accountingService.listLedger });
  const { data: deliveriesRaw = [] } = useQuery({ queryKey: ["deliveries"], queryFn: deliveryService.list });

  const sales = useMemo(() => filterByDateRange(salesRaw, range, (r) => r.date), [salesRaw, range]);
  const purchases = useMemo(() => filterByDateRange(purchasesRaw, range, (r) => r.date), [purchasesRaw, range]);
  const expenses = useMemo(() => filterByDateRange(expensesRaw, range, (r) => r.date), [expensesRaw, range]);
  const ledger = useMemo(() => filterByDateRange(ledgerRaw, range, (r) => r.date), [ledgerRaw, range]);
  const deliveries = useMemo(() => filterByDateRange(deliveriesRaw, range, (r) => r.date), [deliveriesRaw, range]);

  const productSales = useMemo(() => {
    const map = new Map<string, { productName: string; qty: number; amount: number }>();
    for (const so of sales.filter((s) => s.status !== "cancelled")) {
      for (const it of so.items) {
        const cur = map.get(it.productId) ?? { productName: it.productName, qty: 0, amount: 0 };
        cur.qty += it.quantity;
        cur.amount += it.price * it.quantity * (1 + it.taxRate / 100);
        map.set(it.productId, cur);
      }
    }
    return [...map.entries()].map(([id, v]) => ({ id, ...v }));
  }, [sales]);

  const arRows = sales
    .filter((s) => s.total > s.paid && s.status !== "cancelled")
    .map((s) => ({ id: s.id, orderNo: s.orderNo, customerName: s.customerName, due: s.total - s.paid }));

  const apRows = purchases
    .filter((p) => p.total > p.paid && p.status !== "cancelled")
    .map((p) => ({ id: p.id, orderNo: p.orderNo, supplierName: p.supplierName, due: p.total - p.paid }));

  return (
    <div className="space-y-4">
      <PageHeader title={t("reports.title")} description={t("reports.desc")} />
      <div className="rounded-xl border bg-card/60 p-3">
        <DateRangeFilter value={range} onChange={setRange} />
      </div>
      <div className="flex flex-wrap gap-2">
        {reports.map((r) => (
          <Button key={r.id} size="sm" variant={active === r.id ? "default" : "outline"} onClick={() => setActive(r.id)}>
            {t(r.key)}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          {active === "sales" && (
            <DataTable
              rows={sales}
              searchKeys={["orderNo", "customerName"]}
              columns={[
                { key: "no", header: t("sales.orderNo"), render: (r) => r.orderNo },
                { key: "date", header: t("common.date"), render: (r) => formatDate(r.date) },
                { key: "cust", header: t("common.customer"), render: (r) => r.customerName },
                { key: "total", header: t("common.total"), render: (r) => formatCurrency(r.total), className: "text-right" },
                { key: "st", header: t("common.status"), render: (r) => r.status },
              ]}
            />
          )}
          {active === "purchase" && (
            <DataTable
              rows={purchases}
              searchKeys={["orderNo", "supplierName"]}
              columns={[
                { key: "no", header: t("purchases.poNo"), render: (r) => r.orderNo },
                { key: "date", header: t("common.date"), render: (r) => formatDate(r.date) },
                { key: "sup", header: t("common.supplier"), render: (r) => r.supplierName },
                { key: "total", header: t("common.total"), render: (r) => formatCurrency(r.total), className: "text-right" },
                { key: "st", header: t("common.status"), render: (r) => r.status },
              ]}
            />
          )}
          {active === "stock" && (
            <DataTable
              rows={products}
              searchKeys={["name", "code"]}
              columns={[
                { key: "code", header: t("products.code"), render: (r) => r.code },
                { key: "name", header: t("common.product"), render: (r) => r.name },
                { key: "stock", header: t("products.stock"), render: (r) => r.stock, className: "text-right" },
                { key: "reorder", header: t("products.reorder"), render: (r) => r.reorderLevel, className: "text-right" },
              ]}
            />
          )}
          {active === "cylinder" && (
            <DataTable
              rows={cylinders}
              searchKeys={["serialNumber", "location"]}
              columns={[
                { key: "sn", header: t("cylinders.serial"), render: (r) => r.serialNumber },
                { key: "st", header: t("common.status"), render: (r) => r.status },
                { key: "loc", header: t("cylinders.location"), render: (r) => r.location },
              ]}
            />
          )}
          {active === "ar" && (
            <DataTable
              rows={arRows}
              searchKeys={["orderNo", "customerName"]}
              columns={[
                { key: "no", header: t("sales.orderNo"), render: (r) => r.orderNo },
                { key: "cust", header: t("common.customer"), render: (r) => r.customerName },
                { key: "due", header: t("common.due"), render: (r) => formatCurrency(r.due), className: "text-right" },
              ]}
            />
          )}
          {active === "ap" && (
            <DataTable
              rows={apRows}
              searchKeys={["orderNo", "supplierName"]}
              columns={[
                { key: "no", header: t("purchases.poNo"), render: (r) => r.orderNo },
                { key: "sup", header: t("common.supplier"), render: (r) => r.supplierName },
                { key: "due", header: t("common.due"), render: (r) => formatCurrency(r.due), className: "text-right" },
              ]}
            />
          )}
          {active === "cash" && (
            <DataTable
              rows={ledger.filter((e) => e.account === "cash")}
              searchKeys={["notes", "category"]}
              columns={[
                { key: "date", header: t("common.date"), render: (r) => formatDate(r.date) },
                { key: "cat", header: t("accounting.category"), render: (r) => r.category },
                { key: "dir", header: t("accounting.dir"), render: (r) => r.direction },
                { key: "amt", header: t("common.amount"), render: (r) => formatCurrency(r.amount), className: "text-right" },
              ]}
            />
          )}
          {active === "bank" && (
            <DataTable
              rows={ledger.filter((e) => e.account === "bank")}
              searchKeys={["notes", "category"]}
              columns={[
                { key: "date", header: t("common.date"), render: (r) => formatDate(r.date) },
                { key: "cat", header: t("accounting.category"), render: (r) => r.category },
                { key: "dir", header: t("accounting.dir"), render: (r) => r.direction },
                { key: "amt", header: t("common.amount"), render: (r) => formatCurrency(r.amount), className: "text-right" },
              ]}
            />
          )}
          {active === "expense" && (
            <DataTable
              rows={expenses}
              searchKeys={["category", "description"]}
              columns={[
                { key: "date", header: t("common.date"), render: (r) => formatDate(r.date) },
                { key: "cat", header: t("common.category"), render: (r) => r.category },
                { key: "desc", header: t("common.description"), render: (r) => r.description },
                { key: "amt", header: t("common.amount"), render: (r) => formatCurrency(r.amount), className: "text-right" },
              ]}
            />
          )}
          {active === "delivery" && (
            <DataTable
              rows={deliveries}
              searchKeys={["challanNo", "vehicleNo", "driverName"]}
              columns={[
                { key: "no", header: t("deliveries.challanNo"), render: (r) => r.challanNo },
                { key: "veh", header: t("deliveries.vehicle"), render: (r) => r.vehicleNo },
                { key: "drv", header: t("deliveries.driver"), render: (r) => r.driverName },
                { key: "st", header: t("common.status"), render: (r) => r.status },
              ]}
            />
          )}
          {active === "product" && (
            <DataTable
              rows={productSales}
              searchKeys={["productName"]}
              columns={[
                { key: "name", header: t("common.product"), render: (r) => r.productName },
                { key: "qty", header: t("reports.qtySold"), render: (r) => r.qty, className: "text-right" },
                { key: "amt", header: t("common.amount"), render: (r) => formatCurrency(r.amount), className: "text-right" },
              ]}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
