import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supplierService } from "@/services/supplier.service";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { formatCurrency } from "@/utils/formatters";
import type { Supplier } from "@/types";

export function SupplierList() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["suppliers"], queryFn: supplierService.list });

  const remove = useMutation({
    mutationFn: (id: string) => supplierService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Supplier deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Suppliers"
        description="Manage supplier master records."
        actions={<Button asChild><Link to="/suppliers/new"><Plus className="mr-1 h-4 w-4" /> New Supplier</Link></Button>}
      />
      <DataTable<Supplier>
        rows={data}
        searchKeys={["name", "phone"]}
        onRowClick={(r) => navigate({ to: "/suppliers/$id", params: { id: r.id } })}
        columns={[
          { key: "name", header: "Name", sortable: true, sortValue: (r) => r.name, render: (r) => <span className="font-medium">{r.name}</span> },
          { key: "phone", header: "Phone", sortable: true, sortValue: (r) => r.phone, render: (r) => r.phone },
          { key: "gstin", header: "GSTIN", render: (r) => r.gstin ?? "—" },
          { key: "address", header: "Address", render: (r) => <span className="text-muted-foreground">{r.address}</span> },
          { key: "bal", header: "Payable", sortable: true, sortValue: (r) => r.openingBalance, render: (r) => formatCurrency(r.openingBalance), className: "text-right" },
          {
            key: "actions",
            header: "",
            className: "w-24",
            render: (r) => (
              <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                  <Link to="/suppliers/$id/edit" params={{ id: r.id }}><Pencil className="h-4 w-4" /></Link>
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
