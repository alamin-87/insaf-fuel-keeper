import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouteContext } from "@tanstack/react-router";
import { salesService } from "@/services/sales.service";
import { mongoHealthFn } from "@/lib/data.functions";
import { StatCard } from "./widgets/StatCard";
import { StockAlerts } from "./widgets/StockAlert";
import { formatCurrency } from "@/utils/formatters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, HandCoins, Receipt, Users, Truck, Wallet, Building2, Cylinder as CylinderIcon, Database,
} from "lucide-react";

export function Dashboard() {
  const { user } = useRouteContext({ from: "__root__" });
  // Date is computed client-only to avoid SSR/client hydration mismatch
  // (server runs in UTC, user is in Asia/Dhaka — different calendar day).
  const [today, setToday] = useState<string>("");
  useEffect(() => {
    setToday(new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
  }, []);

  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: salesService.dashboard, refetchInterval: 30000 });
  const { data: health } = useQuery({ queryKey: ["mongo-health"], queryFn: () => mongoHealthFn(), refetchInterval: 60000 });
  const s = data ?? {
    todaySales: 0, todayCollection: 0, todayExpense: 0,
    customerDue: 0, supplierPayable: 0, cashBalance: 0, bankBalance: 0,
  };
  const totalDocs = health?.ok ? Object.values(health.counts ?? {}).reduce((a, b) => a + b, 0) : 0;
  const greetingName = user?.displayName || "Operator";

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-primary-glow p-5 text-primary-foreground shadow-elegant sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-primary-glow/40 blur-3xl" />
        <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-primary-foreground/70">Insaf Gas Corp · ERP · Bangladesh</p>
            <h1 className="mt-1 truncate text-xl font-bold sm:text-3xl">
              {isLoading ? "Loading live data…" : `Good day, ${greetingName}`}
            </h1>
            <p className="mt-1 line-clamp-2 text-xs text-primary-foreground/80 sm:text-sm">{today}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <div className="flex items-center gap-2 rounded-full bg-primary-foreground/10 px-3 py-1.5 text-[11px] backdrop-blur">
              <Database className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">MongoDB</span>
              <span className={`inline-block h-2 w-2 rounded-full ${health?.ok ? "bg-emerald-400 animate-pulse" : health ? "bg-red-400" : "bg-yellow-300"}`} />
              <span>{health?.ok ? `${totalDocs} docs` : health ? "offline" : "…"}</span>
            </div>
            <div className="hidden items-center gap-2 rounded-full bg-primary-foreground/10 px-3 py-1 text-[11px] backdrop-blur sm:flex">
              <CylinderIcon className="h-3 w-3" />
              Live snapshot · auto-refresh 30s
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard title="Today's Sales" value={formatCurrency(s.todaySales)} icon={TrendingUp} tone="positive" hint="Across all orders" />
        <StatCard title="Collection" value={formatCurrency(s.todayCollection)} icon={HandCoins} tone="positive" />
        <StatCard title="Expense" value={formatCurrency(s.todayExpense)} icon={Receipt} tone="warning" hint="From expenses ledger" />
        <StatCard title="Customer Dues" value={formatCurrency(s.customerDue)} icon={Users} tone="danger" hint="Receivables" />
        <StatCard title="Supplier Payable" value={formatCurrency(s.supplierPayable)} icon={Truck} tone="warning" hint="Opening balances" />
        <StatCard title="Cash Balance" value={formatCurrency(s.cashBalance)} icon={Wallet} tone="info" hint="Live cash ledger" />
        <StatCard title="Bank Balance" value={formatCurrency(s.bankBalance)} icon={Building2} tone="info" hint="Live bank ledger" />
        <StatCard title="Net Position" value={formatCurrency(s.cashBalance + s.bankBalance - s.supplierPayable)} icon={TrendingUp} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1"><StockAlerts /></div>
        <KanbanView />
      </div>
    </div>
  );
}

function KanbanView() {
  const { data: sales = [] } = useQuery({ queryKey: ["sales"], queryFn: salesService.list });
  const columns = [
    { key: "draft", title: "Draft", tone: "bg-muted text-muted-foreground" },
    { key: "confirmed", title: "Confirmed", tone: "bg-info/15 text-info" },
    { key: "invoiced", title: "Invoiced", tone: "bg-warning/20 text-warning-foreground" },
    { key: "paid", title: "Paid", tone: "bg-success/15 text-success" },
  ] as const;

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Sales Pipeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
          {columns.map((col) => {
            const items = sales.filter((s) => s.status === col.key);
            return (
              <div key={col.key} className="rounded-lg border bg-muted/30 p-2">
                <div className={`mb-2 flex items-center justify-between rounded-md px-2 py-1 ${col.tone}`}>
                  <span className="text-[10px] font-semibold uppercase tracking-wider">{col.title}</span>
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{items.length}</Badge>
                </div>
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
                  {items.length === 0 && <p className="p-2 text-[10px] text-muted-foreground">Empty</p>}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
