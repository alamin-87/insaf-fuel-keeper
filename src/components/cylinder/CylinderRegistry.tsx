import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { cylinderService } from "@/services/cylinder.service";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { RowActions, actionsColumnClass } from "@/components/common/RowActions";
import { formatDateTime } from "@/utils/formatters";
import type { Cylinder, CylinderStatus } from "@/types";
import { useT } from "@/i18n";

const statusVariant: Record<CylinderStatus, "default" | "secondary" | "destructive" | "outline"> = {
  in_stock: "default", at_customer: "secondary", in_transit: "outline",
  refilling: "outline", damaged: "destructive", lost: "destructive",
};

export function CylinderRegistry() {
  const t = useT();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["cylinders"], queryFn: cylinderService.list });

  const remove = useMutation({
    mutationFn: (id: string) => cylinderService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cylinders"] });
      toast.success(t("cylinders.deleted"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title={t("cylinders.title")}
        description={t("cylinders.desc")}
        actions={<Button asChild><Link to="/cylinders/new"><Plus className="mr-1 h-4 w-4" /> {t("cylinders.new")}</Link></Button>}
      />
      <DataTable<Cylinder>
        rows={data}
        searchKeys={["serialNumber", "location"]}
        dateKey="lastMovementAt"
        onRowClick={(r) => navigate({ to: "/cylinders/$id", params: { id: r.id } })}
        columns={[
          { key: "sn", header: t("cylinders.serial"), sortable: true, sortValue: (r) => r.serialNumber, render: (r) => <span className="font-mono">{r.serialNumber}</span> },
          { key: "cap", header: t("cylinders.capacity"), sortable: true, sortValue: (r) => r.capacity, render: (r) => `${r.capacity}` },
          { key: "st", header: t("common.status"), sortable: true, sortValue: (r) => r.status, render: (r) => <Badge variant={statusVariant[r.status]}>{t(`status.${r.status}` as any)}</Badge> },
          { key: "loc", header: t("cylinders.location"), sortable: true, sortValue: (r) => r.location, render: (r) => r.location },
          { key: "mv", header: t("cylinders.lastMovement"), sortable: true, sortValue: (r) => r.lastMovementAt, render: (r) => <span className="text-xs text-muted-foreground">{formatDateTime(r.lastMovementAt)}</span> },
          {
            key: "actions",
            header: t("common.actions"),
            className: actionsColumnClass,
            render: (r) => (
              <RowActions
                onView={() => navigate({ to: "/cylinders/$id", params: { id: r.id } })}
                onEdit={() => navigate({ to: "/cylinders/$id/edit", params: { id: r.id } })}
                onDelete={() => {
                  if (confirm(t("cylinders.deleteConfirm"))) remove.mutate(r.id);
                }}
                deleteDisabled={remove.isPending}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
