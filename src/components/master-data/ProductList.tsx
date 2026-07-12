import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { productService } from "@/services/product.service";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { formatCurrency } from "@/utils/formatters";
import type { Product } from "@/types";

export function ProductList() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["products"], queryFn: productService.list });

  const remove = useMutation({
    mutationFn: (id: string) => productService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Products"
        description="Cylinders, gases and consumables."
        actions={<Button asChild><Link to="/products/new"><Plus className="mr-1 h-4 w-4" /> New Product</Link></Button>}
      />
      <DataTable<Product>
        rows={data}
        searchKeys={["name", "code"]}
        onRowClick={(r) => navigate({ to: "/products/$id", params: { id: r.id } })}
        columns={[
          { key: "code", header: "Code", sortable: true, sortValue: (r) => r.code, render: (r) => <span className="font-mono text-xs">{r.code}</span> },
          { key: "name", header: "Name", sortable: true, sortValue: (r) => r.name, render: (r) => <span className="font-medium">{r.name}</span> },
          { key: "cat", header: "Category", sortable: true, sortValue: (r) => r.category, render: (r) => <Badge variant="secondary">{r.category}</Badge> },
          { key: "uom", header: "UOM", render: (r) => r.uom },
          { key: "price", header: "Price", sortable: true, sortValue: (r) => r.price, render: (r) => formatCurrency(r.price), className: "text-right" },
          { key: "tax", header: "Tax %", sortable: true, sortValue: (r) => r.taxRate, render: (r) => `${r.taxRate}%`, className: "text-right" },
          { key: "stock", header: "Stock", sortable: true, sortValue: (r) => r.stock, render: (r) => (
            <Badge variant={r.stock <= r.reorderLevel ? "destructive" : "outline"}>{r.stock}</Badge>
          ), className: "text-right" },
          {
            key: "actions",
            header: "",
            className: "w-24",
            render: (r) => (
              <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                  <Link to="/products/$id/edit" params={{ id: r.id }}><Pencil className="h-4 w-4" /></Link>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  disabled={remove.isPending}
                  onClick={() => {
                    if (confirm(`Delete ${r.name}?`)) remove.mutate(r.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
