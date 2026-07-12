import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { deliveryService } from "@/services/delivery.service";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { formatDate } from "@/utils/formatters";
import type { Delivery } from "@/types";

export function DeliveryList() {
  const navigate = useNavigate();
  const { data = [] } = useQuery({ queryKey: ["deliveries"], queryFn: deliveryService.list });
  return (
    <div>
      <PageHeader
        title="Delivery Challans"
        description="Track dispatches and confirmations."
        actions={<Button asChild><Link to="/deliveries/new"><Plus className="mr-1 h-4 w-4" /> New Challan</Link></Button>}
      />
      <DataTable<Delivery>
        rows={data}
        searchKeys={["challanNo", "customerName", "vehicleNo"]}
        onRowClick={(r) => navigate({ to: "/deliveries/$id", params: { id: r.id } })}
        columns={[
          { key: "no", header: "Challan #", sortable: true, sortValue: (r) => r.challanNo, render: (r) => <span className="font-mono text-xs">{r.challanNo}</span> },
          { key: "date", header: "Date", sortable: true, sortValue: (r) => r.date, render: (r) => formatDate(r.date) },
          { key: "cust", header: "Customer", sortable: true, sortValue: (r) => r.customerName, render: (r) => <span className="font-medium">{r.customerName}</span> },
          { key: "drv", header: "Driver", sortable: true, sortValue: (r) => r.driverName, render: (r) => r.driverName },
          { key: "veh", header: "Vehicle", sortable: true, sortValue: (r) => r.vehicleNo, render: (r) => <span className="font-mono text-xs">{r.vehicleNo}</span> },
          { key: "st", header: "Status", sortable: true, sortValue: (r) => r.status, render: (r) => (
            <Badge variant={r.status === "pending" ? "secondary" : r.status === "confirmed" ? "outline" : "default"}>
              {r.status}
            </Badge>
          ) },
        ]}
      />
    </div>
  );
}
