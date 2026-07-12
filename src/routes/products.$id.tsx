import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { productService } from "@/services/product.service";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/utils/formatters";
import { useT } from "@/i18n";

export const Route = createFileRoute("/products/$id")({
  component: ProductDetail,
});

function ProductDetail() {
  const t = useT();
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: p, isLoading, isFetched } = useQuery({
    queryKey: ["products", id],
    queryFn: () => productService.get(id),
  });

  const remove = useMutation({
    mutationFn: () => productService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(t("products.deleted"));
      navigate({ to: "/products" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">{t("common.loading")}</div>;
  if (isFetched && !p) return <div className="p-6 text-sm text-destructive">{t("products.notFound")}</div>;
  if (!p) return null;

  return (
    <div>
      <PageHeader
        title={p.name}
        description={`${p.category} · ${p.code}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/products/$id/edit" params={{ id }}><Pencil className="mr-1 h-4 w-4" /> {t("common.edit")}</Link>
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => { if (confirm(`${t("common.delete")} ${p.name}?`)) remove.mutate(); }}
            >
              <Trash2 className="mr-1 h-4 w-4" /> {t("common.delete")}
            </Button>
          </div>
        }
      />
      <Card><CardContent className="pt-6 grid gap-4 md:grid-cols-3 text-sm">
        <div><p className="text-xs uppercase text-muted-foreground">Price</p><p className="font-medium">{formatCurrency(p.price)}</p></div>
        <div><p className="text-xs uppercase text-muted-foreground">Tax</p><p className="font-medium">{p.taxRate}%</p></div>
        <div><p className="text-xs uppercase text-muted-foreground">UOM</p><p className="font-medium">{p.uom}</p></div>
        <div><p className="text-xs uppercase text-muted-foreground">Stock</p><p className="font-medium">{p.stock}</p></div>
        <div><p className="text-xs uppercase text-muted-foreground">Reorder Level</p><p className="font-medium">{p.reorderLevel}</p></div>
      </CardContent></Card>
    </div>
  );
}
