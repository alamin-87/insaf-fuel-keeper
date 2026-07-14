import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouteContext } from "@tanstack/react-router";
import { salesService } from "@/services/sales.service";
import { expenseService } from "@/services/expense.service";
import { StatCard } from "./widgets/StatCard";
import { StockAlerts } from "./widgets/StockAlert";
import { DateRangeFilter } from "@/components/common/DateRangeFilter";
import { formatCurrency } from "@/utils/formatters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, HandCoins, Receipt, Users, Truck, Wallet, Building2, Cylinder as CylinderIcon, Package, AlertTriangle,
} from "lucide-react";
import { useT } from "@/i18n";
import { EMPTY_DATE_RANGE, filterByDateRange, type DateRange } from "@/lib/date-range";

export function Dashboard() {
  const t = useT();
  const { user } = useRouteContext({ from: "__root__" });
  const [today, setToday] = useState<string>("");
  const [range, setRange] = useState<DateRange>(EMPTY_DATE_RANGE);
  useEffect(() => {
    setToday(new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
  }, []);

  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: salesService.dashboard, refetchInterval: 30000 });
  const { data: sales = [] } = useQuery({ queryKey: ["sales"], queryFn: salesService.list });
  const { data: expenses = [] } = useQuery({ queryKey: ["expenses"], queryFn: expenseService.list });

  const s = data ?? {
    todaySales: 0, todayCollection: 0, todayExpense: 0,
    customerDue: 0, supplierPayable: 0, cashBalance: 0, bankBalance: 0,
    availableStock: 0, cylindersInWarehouse: 0, cylindersWithCustomers: 0,
    cylindersUnderRefill: 0, damagedCylinders: 0, lostCylinders: 0, monthlySales: 0,
  };

  const filteredSales = useMemo(
    () => filterByDateRange(sales, range, (r) => r.date).filter((o) => o.status !== "cancelled"),
    [sales, range],
  );
  const filteredExpenses = useMemo(
    () => filterByDateRange(expenses, range, (r) => r.date),
    [expenses, range],
  );

  const periodActive = range.preset !== "all";
  const periodSales = filteredSales.reduce((a, o) => a + o.total, 0);
  const periodCollection = filteredSales.reduce((a, o) => a + o.paid, 0);
  const periodExpense = filteredExpenses.reduce((a, o) => a + o.amount, 0);

  const greetingName = user?.displayName || "Operator";

  return (
    <div className="space-y-5 sm:space-y-6">
      <div data-reveal className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-primary-glow p-5 text-primary-foreground shadow-elegant opacity-0 sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-primary-glow/40 blur-3xl" />
        <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-primary-foreground/70">{t("dash.region")}</p>
            <h1 className="mt-1 truncate text-xl font-bold sm:text-3xl">
              {isLoading ? t("dash.loading") : t("dash.greeting", { name: greetingName })}
            </h1>
            <p className="mt-1 line-clamp-2 text-xs text-primary-foreground/80 sm:text-sm">{today}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <div className="hidden items-center gap-2 rounded-full bg-primary-foreground/10 px-3 py-1 text-[11px] backdrop-blur sm:flex">
              <CylinderIcon className="h-3 w-3" />
              {t("dash.live")}
            </div>
          </div>
        </div>
      </div>

      <div data-reveal className="rounded-xl border bg-card/60 p-3 opacity-0 backdrop-blur-sm">
        <DateRangeFilter value={range} onChange={setRange} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div data-reveal className="opacity-0">
        <StatCard
          title={periodActive ? t("dash.periodSales") : t("dash.todaySales")}
          value={formatCurrency(periodActive ? periodSales : s.todaySales)}
          icon={TrendingUp}
          tone="positive"
          hint={t("dash.hintOrders")}
          to="/sales"
        />
        </div>
        <div data-reveal className="opacity-0">
        <StatCard
          title={periodActive ? t("dash.periodCollection") : t("dash.collection")}
          value={formatCurrency(periodActive ? periodCollection : s.todayCollection)}
          icon={HandCoins}
          tone="positive"
          to="/sales"
        />
        </div>
        <div data-reveal className="opacity-0">
        <StatCard
          title={periodActive ? t("dash.periodExpense") : t("dash.expense")}
          value={formatCurrency(periodActive ? periodExpense : s.todayExpense)}
          icon={Receipt}
          tone="warning"
          hint={t("dash.hintExpense")}
          to="/expenses"
        />
        </div>
        <div data-reveal className="opacity-0">
        <StatCard title={t("dash.customerDue")} value={formatCurrency(s.customerDue)} icon={Users} tone="danger" hint={t("dash.hintReceivables")} to="/customers" />
        </div>
        <div data-reveal className="opacity-0">
        <StatCard title={t("dash.supplierPayable")} value={formatCurrency(s.supplierPayable)} icon={Truck} tone="warning" hint={t("dash.hintPayable")} to="/purchases" />
        </div>
        <div data-reveal className="opacity-0">
        <StatCard title={t("dash.cashBalance")} value={formatCurrency(s.cashBalance)} icon={Wallet} tone="info" hint={t("dash.hintCash")} to="/accounting" />
        </div>
        <div data-reveal className="opacity-0">
        <StatCard title={t("dash.bankBalance")} value={formatCurrency(s.bankBalance)} icon={Building2} tone="info" hint={t("dash.hintBank")} to="/accounting" />
        </div>
        <div data-reveal className="opacity-0">
        <StatCard
          title={t("dash.monthlySales")}
          value={formatCurrency(periodActive ? periodSales : s.monthlySales)}
          icon={TrendingUp}
          tone="positive"
          to="/reports"
        />
        </div>
        <div data-reveal className="opacity-0">
        <StatCard title={t("dash.availableStock")} value={String(s.availableStock)} icon={Package} hint={t("dash.hintUnits")} to="/inventory" />
        </div>
        <div data-reveal className="opacity-0">
        <StatCard title={t("dash.cylWarehouse")} value={String(s.cylindersInWarehouse)} icon={CylinderIcon} tone="info" to="/cylinders" />
        </div>
        <div data-reveal className="opacity-0">
        <StatCard title={t("dash.cylCustomers")} value={String(s.cylindersWithCustomers)} icon={Users} to="/cylinders" />
        </div>
        <div data-reveal className="opacity-0">
        <StatCard title={t("dash.cylRefillDamage")} value={`${s.cylindersUnderRefill} / ${s.damagedCylinders + s.lostCylinders}`} icon={AlertTriangle} tone="warning" to="/cylinders" />
        </div>
      </div>

      <div data-reveal className="grid gap-4 opacity-0 lg:grid-cols-3">
        <div className="lg:col-span-1"><StockAlerts /></div>
        <KanbanView sales={filteredSales} />
      </div>
    </div>
  );
}

function KanbanView({ sales }: { sales: Awaited<ReturnType<typeof salesService.list>> }) {
  const t = useT();
  const columns = [
    { key: "draft", title: t("status.draft"), tone: "bg-muted text-muted-foreground" },
    { key: "confirmed", title: t("status.confirmed"), tone: "bg-info/15 text-info" },
    { key: "invoiced", title: t("status.invoiced"), tone: "bg-warning/20 text-warning-foreground" },
    { key: "paid", title: t("status.paid"), tone: "bg-success/15 text-success" },
  ] as const;

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Link to="/sales" className="hover:text-primary hover:underline underline-offset-2">
            {t("dash.pipeline")}
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
          {columns.map((col) => {
            const items = sales.filter((s) => s.status === col.key);
            return (
              <div key={col.key} className="rounded-lg border bg-muted/30 p-2">
                <Link
                  to="/sales"
                  className={`mb-2 flex items-center justify-between rounded-md px-2 py-1 transition hover:opacity-90 ${col.tone}`}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wider">{col.title}</span>
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{items.length}</Badge>
                </Link>
                <div className="space-y-2">
                  {items.map((o) => (
                    <Link
                      key={o.id}
                      to="/sales/$id"
                      params={{ id: o.id }}
                      className="block rounded-md border bg-card p-2 text-xs shadow-sm transition hover:border-primary/40"
                    >
                      <p className="truncate font-mono text-[10px] text-muted-foreground">{o.orderNo}</p>
                      <p className="mt-0.5 truncate font-medium">{o.customerName}</p>
                      <p className="mt-1 font-semibold">{formatCurrency(o.total)}</p>
                    </Link>
                  ))}
                  {items.length === 0 && <p className="p-2 text-[10px] text-muted-foreground">{t("dash.empty")}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
