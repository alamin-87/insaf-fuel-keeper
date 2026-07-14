import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { purchaseService } from "@/services/purchase.service";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { RowActions, actionsColumnClass } from "@/components/common/RowActions";
import { formatCurrency, formatDate } from "@/utils/formatters";
import type { PurchaseOrder, PurchaseStatus } from "@/types";
import { useT } from "@/i18n";

const statusVariant: Record<PurchaseStatus, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary", ordered: "outline", received: "default", billed: "default", paid: "default", cancelled: "destructive",
};

export function PurchaseList() {
  const t = useT();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["purchases"], queryFn: purchaseService.list });

  const remove = useMutation({
    mutationFn: (id: string) => purchaseService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchases"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(t("purchases.deleted"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title={t("purchases.title")}
        description={t("purchases.desc")}
        actions={<Button asChild><Link to="/purchases/new"><Plus className="mr-1 h-4 w-4" /> {t("purchases.new")}</Link></Button>}
      />
      <DataTable<PurchaseOrder>
        rows={data}
        searchKeys={["orderNo", "supplierName"]}
        dateKey="date"
        onRowClick={(r) => navigate({ to: "/purchases/$id", params: { id: r.id } })}
        columns={[
          { key: "no", header: t("purchases.poNo"), sortable: true, sortValue: (r) => r.orderNo, render: (r) => <span className="font-mono text-xs">{r.orderNo}</span> },
          { key: "date", header: t("common.date"), sortable: true, sortValue: (r) => r.date, render: (r) => formatDate(r.date) },
          { key: "sup", header: t("common.supplier"), sortable: true, sortValue: (r) => r.supplierName, render: (r) => <span className="font-medium">{r.supplierName}</span> },
          { key: "total", header: t("common.total"), sortable: true, sortValue: (r) => r.total, render: (r) => formatCurrency(r.total), className: "text-right" },
          { key: "paid", header: t("common.paid"), sortable: true, sortValue: (r) => r.paid, render: (r) => formatCurrency(r.paid), className: "text-right" },
          { key: "due", header: t("common.due"), sortable: true, sortValue: (r) => r.total - r.paid, render: (r) => formatCurrency(r.total - r.paid), className: "text-right" },
          { key: "st", header: t("common.status"), sortable: true, sortValue: (r) => r.status, render: (r) => <Badge variant={statusVariant[r.status]}>{t(`status.${r.status}` as any)}</Badge> },
          {
            key: "actions",
            header: t("common.actions"),
            className: actionsColumnClass,
            render: (r) => (
              <RowActions
                onView={() => navigate({ to: "/purchases/$id", params: { id: r.id } })}
                onEdit={r.status === "draft" || r.status === "ordered"
                  ? () => navigate({ to: "/purchases/$id/edit", params: { id: r.id } })
                  : undefined}
                onDelete={r.status === "draft" || r.status === "cancelled" ? () => {
                  if (confirm(t("purchases.deleteConfirm"))) remove.mutate(r.id);
                } : undefined}
                deleteDisabled={remove.isPending}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
