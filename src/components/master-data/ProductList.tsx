import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { productService } from "@/services/product.service";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { RowActions, actionsColumnClass } from "@/components/common/RowActions";
import { formatCurrency } from "@/utils/formatters";
import type { Product } from "@/types";
import { useT } from "@/i18n";

export function ProductList() {
  const t = useT();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["products"], queryFn: productService.list });

  const remove = useMutation({
    mutationFn: (id: string) => productService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success(t("products.deleted"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title={t("products.title")}
        description={t("products.desc")}
        actions={<Button asChild><Link to="/products/new"><Plus className="mr-1 h-4 w-4" /> {t("products.new")}</Link></Button>}
      />
      <DataTable<Product>
        rows={data}
        searchKeys={["name", "code"]}
        dateKey="createdAt"
        onRowClick={(r) => navigate({ to: "/products/$id", params: { id: r.id } })}
        columns={[
          { key: "code", header: t("products.code"), sortable: true, sortValue: (r) => r.code, render: (r) => <span className="font-mono text-xs">{r.code}</span> },
          { key: "name", header: t("common.name"), sortable: true, sortValue: (r) => r.name, render: (r) => <span className="font-medium">{r.name}</span> },
          { key: "cat", header: t("common.category"), sortable: true, sortValue: (r) => r.category, render: (r) => <Badge variant="secondary">{r.category}</Badge> },
          { key: "uom", header: t("products.uom"), render: (r) => r.uom },
          { key: "price", header: t("common.price"), sortable: true, sortValue: (r) => r.price, render: (r) => formatCurrency(r.price), className: "text-right" },
          { key: "tax", header: t("products.taxPct"), sortable: true, sortValue: (r) => r.taxRate, render: (r) => `${r.taxRate}%`, className: "text-right" },
          { key: "stock", header: t("products.stock"), sortable: true, sortValue: (r) => r.stock, render: (r) => (
            <Badge variant={r.stock <= r.reorderLevel ? "destructive" : "outline"}>{r.stock}</Badge>
          ), className: "text-right" },
          {
            key: "actions",
            header: t("common.actions"),
            className: actionsColumnClass,
            render: (r) => (
              <RowActions
                onView={() => navigate({ to: "/products/$id", params: { id: r.id } })}
                onEdit={() => navigate({ to: "/products/$id/edit", params: { id: r.id } })}
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
