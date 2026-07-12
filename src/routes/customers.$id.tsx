import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { customerService } from "@/services/customer.service";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { useT } from "@/i18n";

export const Route = createFileRoute("/customers/$id")({
  component: CustomerDetail,
});

function CustomerDetail() {
  const t = useT();
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: c, isLoading, isFetched } = useQuery({
    queryKey: ["customers", id],
    queryFn: () => customerService.get(id),
  });

  const remove = useMutation({
    mutationFn: () => customerService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success(t("customers.deleted"));
      navigate({ to: "/customers" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">{t("common.loading")}</div>;
  if (isFetched && !c) return <div className="p-6 text-sm text-destructive">{t("customers.notFound")}</div>;
  if (!c) return null;

  return (
    <div>
      <PageHeader
        title={c.name}
        description={c.address}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/customers/$id/edit" params={{ id }}><Pencil className="mr-1 h-4 w-4" /> {t("common.edit")}</Link>
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => {
                if (confirm(`${t("common.delete")} ${c.name}?`)) remove.mutate();
              }}
            >
              <Trash2 className="mr-1 h-4 w-4" /> {t("common.delete")}
            </Button>
          </div>
        }
      />
      <Card><CardContent className="pt-6 grid gap-4 md:grid-cols-2 text-sm">
        <Info label={t("common.phone")} value={c.phone} />
        <Info label={t("common.email")} value={c.email || "—"} />
        <Info label={t("customers.gstin")} value={c.gstin || "—"} />
        <Info label={t("customers.openingBal")} value={formatCurrency(c.openingBalance)} />
        <Info label={t("common.date")} value={formatDate(c.createdAt)} />
      </CardContent></Card>
    </div>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs uppercase text-muted-foreground">{label}</p><p className="font-medium">{value}</p></div>;
}
