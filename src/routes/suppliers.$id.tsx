import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { supplierService } from "@/services/supplier.service";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/utils/formatters";
import { useT } from "@/i18n";

export const Route = createFileRoute("/suppliers/$id")({
  component: SupplierDetail,
});

function SupplierDetail() {
  const t = useT();
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: s, isLoading, isFetched } = useQuery({
    queryKey: ["suppliers", id],
    queryFn: () => supplierService.get(id),
  });

  const remove = useMutation({
    mutationFn: () => supplierService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success(t("suppliers.deleted"));
      navigate({ to: "/suppliers" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">{t("common.loading")}</div>;
  if (isFetched && !s) return <div className="p-6 text-sm text-destructive">{t("suppliers.notFound")}</div>;
  if (!s) return null;

  return (
    <div>
      <PageHeader
        title={s.name}
        description={s.address}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/suppliers/$id/edit" params={{ id }}><Pencil className="mr-1 h-4 w-4" /> {t("common.edit")}</Link>
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => { if (confirm(`${t("common.delete")} ${s.name}?`)) remove.mutate(); }}
            >
              <Trash2 className="mr-1 h-4 w-4" /> {t("common.delete")}
            </Button>
          </div>
        }
      />
      <Card><CardContent className="pt-6 grid gap-4 md:grid-cols-2 text-sm">
        <div><p className="text-xs uppercase text-muted-foreground">{t("common.phone")}</p><p className="font-medium">{s.phone}</p></div>
        <div><p className="text-xs uppercase text-muted-foreground">{t("customers.gstin")}</p><p className="font-medium">{s.gstin || "—"}</p></div>
        <div><p className="text-xs uppercase text-muted-foreground">{t("suppliers.payable")}</p><p className="font-medium">{formatCurrency(s.openingBalance)}</p></div>
      </CardContent></Card>
    </div>
  );
}
