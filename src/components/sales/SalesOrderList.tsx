import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { salesService } from "@/services/sales.service";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { formatCurrency, formatDate } from "@/utils/formatters";
import type { SalesOrder, SalesStatus } from "@/types";

const statusVariant: Record<SalesStatus, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary", confirmed: "outline", invoiced: "default", paid: "default", cancelled: "destructive",
};

export function SalesOrderList() {
  const navigate = useNavigate();
  const { data = [] } = useQuery({ queryKey: ["sales"], queryFn: salesService.list });
  return (
    <div>
      <PageHeader
        title="Sales Orders"
        description="Orders, invoices and payments."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild><Link to="/sales/quotation">Quotation</Link></Button>
            <Button asChild><Link to="/sales/new"><Plus className="mr-1 h-4 w-4" /> New Order</Link></Button>
          </div>
        }
      />
      <DataTable<SalesOrder>
        rows={data}
        searchKeys={["orderNo", "customerName"]}
        onRowClick={(r) => navigate({ to: "/sales/$id", params: { id: r.id } })}
        columns={[
          { key: "no", header: "Order #", sortable: true, sortValue: (r) => r.orderNo, render: (r) => <span className="font-mono text-xs">{r.orderNo}</span> },
          { key: "date", header: "Date", sortable: true, sortValue: (r) => r.date, render: (r) => formatDate(r.date) },
          { key: "cust", header: "Customer", sortable: true, sortValue: (r) => r.customerName, render: (r) => <span className="font-medium">{r.customerName}</span> },
          { key: "total", header: "Total", sortable: true, sortValue: (r) => r.total, render: (r) => formatCurrency(r.total), className: "text-right" },
          { key: "paid", header: "Paid", sortable: true, sortValue: (r) => r.paid, render: (r) => formatCurrency(r.paid), className: "text-right" },
          { key: "due", header: "Due", sortable: true, sortValue: (r) => r.total - r.paid, render: (r) => formatCurrency(r.total - r.paid), className: "text-right" },
          { key: "st", header: "Status", sortable: true, sortValue: (r) => r.status, render: (r) => <Badge variant={statusVariant[r.status]}>{r.status}</Badge> },
        ]}
      />
    </div>
  );
}
