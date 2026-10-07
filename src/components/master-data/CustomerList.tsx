import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { FileText, Plus } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { customerService } from "@/services/customer.service";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { RowActions, actionsColumnClass } from "@/components/common/RowActions";
import { PartyNameLink } from "@/components/common/PartyNameLink";
import { formatCurrency, formatOpenedOn } from "@/utils/formatters";
import type { Customer } from "@/types";
import { customerOpeningSigned } from "@/lib/customer-balance";
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
          <>
            <Button asChild>
              <Link to="/customers/report">{t("customers.report")}</Link>
            </Button>
            <Button asChild>
              <Link to="/customers/new">
                <Plus className="mr-1 h-4 w-4" /> {t("customers.new")}
              </Link>
            </Button>
          </>
        }
      />
      <DataTable<Customer>
        rows={data}
        searchKeys={["name", "phone", "whatsapp"]}
        dateKey="createdAt"
        onRowClick={(r) => navigate({ to: "/customers/$id", params: { id: r.id } })}
        columns={[
          {
            key: "since",
            header: t("customers.since"),
            sortable: true,
            sortValue: (r) => r.createdAt,
            render: (r) => (
              <span className="whitespace-nowrap text-xs text-muted-foreground">
                {formatOpenedOn(r.createdAt)}
              </span>
            ),
            className: "min-w-[9.5rem] whitespace-nowrap",
          },
          {
            key: "name",
            header: t("common.name"),
            sortable: true,
            sortValue: (r) => r.name,
            render: (r) => (
              <PartyNameLink
                kind="customer"
                id={r.id}
                name={r.name}
                className="whitespace-normal break-words"
              />
            ),
            className: "min-w-[8rem] max-w-[14rem] align-top",
          },
          {
            key: "phone",
            header: t("common.phone"),
            sortable: true,
            sortValue: (r) => r.phone,
            render: (r) => r.phone,
            className: "min-w-[7.5rem] whitespace-nowrap",
          },
          {
            key: "whatsapp",
            header: t("customers.whatsapp"),
            render: (r) => r.whatsapp || "—",
            className: "min-w-[7.5rem] whitespace-nowrap",
          },
          {
            key: "address",
            header: t("common.address"),
            render: (r) => (
              <span className="whitespace-normal break-words text-muted-foreground">
                {r.address}
              </span>
            ),
            className: "min-w-[10rem] max-w-[16rem] align-top",
          },
          {
            key: "bal",
            header: t("customers.openingBalance"),
            sortable: true,
            sortValue: (r) => customerOpeningSigned(r),
            render: (r) => formatCurrency(customerOpeningSigned(r)),
            className: "min-w-[9.5rem] whitespace-nowrap text-right tabular-nums pr-4",
          },
          {
            key: "actions",
            header: t("common.actions"),
            className: `${actionsColumnClass} min-w-[20rem] w-[20rem] px-3`,
            render: (r) => (
              <RowActions
                onView={() => navigate({ to: "/customers/$id", params: { id: r.id } })}
                onEdit={() => navigate({ to: "/customers/$id/edit", params: { id: r.id } })}
                extras={[
                  {
                    label: t("customers.statement"),
                    icon: <FileText className="h-3.5 w-3.5" />,
                    onClick: () =>
                      navigate({ to: "/customers/$id/statement", params: { id: r.id } }),
                  },
                ]}
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
