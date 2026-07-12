import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { customerService } from "@/services/customer.service";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { formatCurrency } from "@/utils/formatters";
import type { Customer } from "@/types";

export function CustomerList() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["customers"], queryFn: customerService.list });

  const remove = useMutation({
    mutationFn: (id: string) => customerService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Customer deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Manage customer master records."
        actions={
          <Button asChild>
            <Link to="/customers/new"><Plus className="mr-1 h-4 w-4" /> New Customer</Link>
          </Button>
        }
      />
      <DataTable<Customer>
        rows={data}
        searchKeys={["name", "phone", "email"]}
        onRowClick={(r) => navigate({ to: "/customers/$id", params: { id: r.id } })}
        columns={[
          { key: "name", header: "Name", sortable: true, sortValue: (r) => r.name, render: (r) => <span className="font-medium">{r.name}</span> },
          { key: "phone", header: "Phone", sortable: true, sortValue: (r) => r.phone, render: (r) => r.phone },
          { key: "gstin", header: "GSTIN", render: (r) => r.gstin ?? "—" },
          { key: "address", header: "Address", render: (r) => <span className="text-muted-foreground">{r.address}</span> },
          { key: "bal", header: "Opening Bal", sortable: true, sortValue: (r) => r.openingBalance, render: (r) => formatCurrency(r.openingBalance), className: "text-right" },
          {
            key: "actions",
            header: "",
            className: "w-24",
            render: (r) => (
              <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                  <Link to="/customers/$id/edit" params={{ id: r.id }}><Pencil className="h-4 w-4" /></Link>
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
