import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { deliveryService } from "@/services/delivery.service";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { formatDateTime } from "@/utils/formatters";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export function DeliveryChallan({ id }: { id: string }) {
  const qc = useQueryClient();
  const { data: d, isLoading, isFetched } = useQuery({
    queryKey: ["deliveries", id],
    queryFn: () => deliveryService.get(id),
  });
  const confirm = useMutation({
    mutationFn: () => deliveryService.confirm(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deliveries"] });
      qc.invalidateQueries({ queryKey: ["deliveries", id] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Delivery confirmed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (isFetched && !d) return <div className="p-6 text-sm text-destructive">Delivery not found.</div>;
  if (!d) return null;

  return (
    <div>
      <PageHeader
        title={`Challan ${d.challanNo}`}
        description={`To ${d.customerName}`}
        actions={<Badge>{d.status}</Badge>}
      />
      <Card><CardContent className="pt-6 space-y-4">
        <div className="grid gap-4 md:grid-cols-4 text-sm">
          <Info label="Driver" value={d.driverName} />
          <Info label="Vehicle" value={d.vehicleNo} />
          <Info
            label="Sales Order"
            value={d.salesOrderId ? (
              <Link className="font-medium text-primary underline-offset-2 hover:underline" to="/sales/$id" params={{ id: d.salesOrderId }}>
                View linked SO
              </Link>
            ) : "—"}
          />
          <Info label="Confirmed At" value={d.confirmedAt ? formatDateTime(d.confirmedAt) : "—"} />
        </div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Item</TableHead><TableHead className="text-right">Qty</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {d.items.map((it, i) => (
              <TableRow key={i}>
                <TableCell>{it.productName}</TableCell>
                <TableCell className="text-right">{it.quantity}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex justify-end">
          <Button onClick={() => confirm.mutate()} disabled={d.status !== "pending" || confirm.isPending}>
            {d.status === "pending" ? "Confirm Delivery" : d.status === "delivered" ? "Delivered" : "Confirmed"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Signature capture available in Phase 2.</p>
      </CardContent></Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <div className="font-medium">{value}</div>
    </div>
  );
}
