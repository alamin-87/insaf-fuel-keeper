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
  { id: "gl", key: "reports.gl" },
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

  const arRows = useMemo(() => {
    const map = new Map<string, { id: string; customerName: string; due: number; orders: { id: string; orderNo: string; date: string; due: number }[] }>();
    for (const s of sales) {
      if (s.total > s.paid && s.status !== "cancelled") {
        const due = s.total - s.paid;
        const cur = map.get(s.customerId) ?? { id: s.customerId, customerName: s.customerName, due: 0, orders: [] };
        cur.due += due;
        cur.orders.push({ id: s.id, orderNo: s.orderNo, date: s.date, due });
        map.set(s.customerId, cur);
      }
    }
    return [...map.values()];
  }, [sales]);

  const apRows = useMemo(() => {
    const map = new Map<string, { id: string; supplierName: string; due: number; orders: { id: string; orderNo: string; date: string; due: number }[] }>();
    for (const p of purchases) {
      if (p.total > p.paid && p.status !== "cancelled") {
        const due = p.total - p.paid;
        const cur = map.get(p.supplierId) ?? { id: p.supplierId, supplierName: p.supplierName, due: 0, orders: [] };
        cur.due += due;
        cur.orders.push({ id: p.id, orderNo: p.orderNo, date: p.date, due });
        map.set(p.supplierId, cur);
      }
    }
    return [...map.values()];
  }, [purchases]);

  const glRows = useMemo(() => {
    const map = new Map<string, { id: string; accountName: string; totalDebit: number; totalCredit: number; balance: number; entries: any[] }>();
    for (const e of ledger) {
      // Treat "in" as Debit, "out" as Credit
      const isDebit = e.direction === "in";
      const debit = isDebit ? e.amount : 0;
      const credit = !isDebit ? e.amount : 0;

      const cur = map.get(e.account) ?? { id: e.account, accountName: e.account, totalDebit: 0, totalCredit: 0, balance: 0, entries: [] };
      cur.totalDebit += debit;
      cur.totalCredit += credit;
      cur.balance += (debit - credit);
      cur.entries.push({ ...e, debit, credit });
      map.set(e.account, cur);
    }
    // Sort entries by date and compute running balance
    for (const acc of map.values()) {
      acc.entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      let run = 0;
      for (const ent of acc.entries) {
        run += ent.debit - ent.credit;
        ent.runningBalance = run;
      }
    }
    return [...map.values()];
  }, [ledger]);

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
              searchKeys={["customerName"]}
              columns={[
                { key: "cust", header: t("common.customer"), render: (r) => <span className="font-medium">{r.customerName}</span> },
                { key: "orders", header: t("sales.title"), render: (r) => <span className="text-muted-foreground text-sm">{r.orders.length} {t("sales.title")}</span> },
                { key: "due", header: t("common.due"), render: (r) => <span className="font-medium">{formatCurrency(r.due)}</span>, className: "text-right" },
              ]}
              renderSubComponent={(r) => (
                <div className="bg-muted/30 p-4 pl-12 rounded-b-md">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground text-left">
                        <th className="pb-2 font-medium">{t("sales.orderNo")}</th>
                        <th className="pb-2 font-medium">{t("common.date")}</th>
                        <th className="pb-2 font-medium text-right">{t("common.due")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.orders.map((o) => (
                        <tr key={o.id} className="border-b last:border-0">
                          <td className="py-2">{o.orderNo}</td>
                          <td className="py-2">{formatDate(o.date)}</td>
                          <td className="py-2 text-right">{formatCurrency(o.due)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            />
          )}
          {active === "ap" && (
            <DataTable
              rows={apRows}
              searchKeys={["supplierName"]}
              columns={[
                { key: "sup", header: t("common.supplier"), render: (r) => <span className="font-medium">{r.supplierName}</span> },
                { key: "orders", header: t("purchases.title"), render: (r) => <span className="text-muted-foreground text-sm">{r.orders.length} {t("purchases.title")}</span> },
                { key: "due", header: t("common.due"), render: (r) => <span className="font-medium">{formatCurrency(r.due)}</span>, className: "text-right" },
              ]}
              renderSubComponent={(r) => (
                <div className="bg-muted/30 p-4 pl-12 rounded-b-md">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground text-left">
                        <th className="pb-2 font-medium">{t("purchases.poNo")}</th>
                        <th className="pb-2 font-medium">{t("common.date")}</th>
                        <th className="pb-2 font-medium text-right">{t("common.due")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.orders.map((o) => (
                        <tr key={o.id} className="border-b last:border-0">
                          <td className="py-2">{o.orderNo}</td>
                          <td className="py-2">{formatDate(o.date)}</td>
                          <td className="py-2 text-right">{formatCurrency(o.due)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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
          {active === "gl" && (
            <DataTable
              rows={glRows}
              searchKeys={["accountName"]}
              columns={[
                { key: "acc", header: t("common.account"), render: (r) => <span className="font-medium capitalize">{r.accountName}</span> },
                { key: "dr", header: "Total Debit", render: (r) => formatCurrency(r.totalDebit), className: "text-right" },
                { key: "cr", header: "Total Credit", render: (r) => formatCurrency(r.totalCredit), className: "text-right" },
                { key: "bal", header: "Balance", render: (r) => <span className="font-medium">{formatCurrency(r.balance)}</span>, className: "text-right" },
              ]}
              renderSubComponent={(r) => (
                <div className="bg-muted/30 p-4 pl-12 rounded-b-md overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground text-left">
                        <th className="pb-2 font-medium">{t("common.date")}</th>
                        <th className="pb-2 font-medium">Doc/Ref</th>
                        <th className="pb-2 font-medium">{t("common.notes")}</th>
                        <th className="pb-2 font-medium text-right">Debit</th>
                        <th className="pb-2 font-medium text-right">Credit</th>
                        <th className="pb-2 font-medium text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.entries.map((ent) => (
                        <tr key={ent.id} className="border-b last:border-0">
                          <td className="py-2 whitespace-nowrap">{formatDate(ent.date)}</td>
                          <td className="py-2">{ent.refId ? `${ent.refType}: ${ent.refId.substring(0, 8)}` : "—"}</td>
                          <td className="py-2">{ent.notes || ent.category}</td>
                          <td className="py-2 text-right">{ent.debit ? formatCurrency(ent.debit) : "—"}</td>
                          <td className="py-2 text-right">{ent.credit ? formatCurrency(ent.credit) : "—"}</td>
                          <td className="py-2 text-right font-medium">{formatCurrency(ent.runningBalance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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
