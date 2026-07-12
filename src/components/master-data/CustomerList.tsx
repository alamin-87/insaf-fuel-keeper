import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { customerService } from "@/services/customer.service";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { RowActions, actionsColumnClass } from "@/components/common/RowActions";
import { formatCurrency } from "@/utils/formatters";
import type { Customer } from "@/types";
import { useT } from "@/i18n";

export function CustomerList() {
  const t = useT();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["customers"], queryFn: customerService.list });

  const remove = useMutation({
    mutationFn: (id: string) => customerService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success(t("customers.deleted"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title={t("customers.title")}
        description={t("customers.desc")}
        actions={
          <Button asChild>
            <Link to="/customers/new"><Plus className="mr-1 h-4 w-4" /> {t("customers.new")}</Link>
          </Button>
        }
      />
      <DataTable<Customer>
        rows={data}
        searchKeys={["name", "phone", "email"]}
        dateKey="createdAt"
        onRowClick={(r) => navigate({ to: "/customers/$id", params: { id: r.id } })}
        columns={[
          { key: "name", header: t("common.name"), sortable: true, sortValue: (r) => r.name, render: (r) => <span className="font-medium">{r.name}</span> },
          { key: "phone", header: t("common.phone"), sortable: true, sortValue: (r) => r.phone, render: (r) => r.phone },
          { key: "gstin", header: t("customers.gstin"), render: (r) => r.gstin ?? "—" },
          { key: "address", header: t("common.address"), render: (r) => <span className="text-muted-foreground">{r.address}</span> },
          { key: "bal", header: t("customers.openingBal"), sortable: true, sortValue: (r) => r.openingBalance, render: (r) => formatCurrency(r.openingBalance), className: "text-right" },
          {
            key: "actions",
            header: t("common.actions"),
            className: actionsColumnClass,
            render: (r) => (
              <RowActions
                onView={() => navigate({ to: "/customers/$id", params: { id: r.id } })}
                onEdit={() => navigate({ to: "/customers/$id/edit", params: { id: r.id } })}
                onDelete={() => {
                  if (confirm(`${t("common.delete")} ${r.name}?`)) remove.mutate(r.id);
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
