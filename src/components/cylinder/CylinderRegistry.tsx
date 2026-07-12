import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { cylinderService } from "@/services/cylinder.service";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { formatDateTime } from "@/utils/formatters";
import type { Cylinder, CylinderStatus } from "@/types";

const statusLabel: Record<CylinderStatus, string> = {
  in_stock: "In Stock", at_customer: "At Customer", in_transit: "In Transit",
  refilling: "Refilling", damaged: "Damaged",
};
const statusVariant: Record<CylinderStatus, "default" | "secondary" | "destructive" | "outline"> = {
  in_stock: "default", at_customer: "secondary", in_transit: "outline",
  refilling: "outline", damaged: "destructive",
};

export function CylinderRegistry() {
  const navigate = useNavigate();
  const { data = [] } = useQuery({ queryKey: ["cylinders"], queryFn: cylinderService.list });
  return (
    <div>
      <PageHeader
        title="Cylinder Registry"
        description="Serialized cylinder tracking with full audit trail."
        actions={<Button asChild><Link to="/cylinders/new"><Plus className="mr-1 h-4 w-4" /> Register Cylinder</Link></Button>}
      />
      <DataTable<Cylinder>
        rows={data}
        searchKeys={["serialNumber", "location"]}
        onRowClick={(r) => navigate({ to: "/cylinders/$id", params: { id: r.id } })}
        columns={[
          { key: "sn", header: "Serial #", sortable: true, sortValue: (r) => r.serialNumber, render: (r) => <span className="font-mono">{r.serialNumber}</span> },
          { key: "cap", header: "Capacity", sortable: true, sortValue: (r) => r.capacity, render: (r) => `${r.capacity}` },
          { key: "st", header: "Status", sortable: true, sortValue: (r) => r.status, render: (r) => <Badge variant={statusVariant[r.status]}>{statusLabel[r.status]}</Badge> },
          { key: "loc", header: "Location", sortable: true, sortValue: (r) => r.location, render: (r) => r.location },
          { key: "mv", header: "Last Movement", sortable: true, sortValue: (r) => r.lastMovementAt, render: (r) => <span className="text-xs text-muted-foreground">{formatDateTime(r.lastMovementAt)}</span> },
        ]}
      />
    </div>
  );
}
