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
import { useT } from "@/i18n";

export function DeliveryChallan({ id }: { id: string }) {
  const t = useT();
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
      toast.success(t("deliveries.confirm"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">{t("common.loading")}</div>;
  if (isFetched && !d) return <div className="p-6 text-sm text-destructive">{t("deliveries.notFound")}</div>;
  if (!d) return null;

  return (
    <div>
      <PageHeader
        title={`${t("deliveries.challanNo")} ${d.challanNo}`}
        description={`${t("common.customer")}: ${d.customerName}`}
        actions={<Badge>{t(`status.${d.status}` as any)}</Badge>}
      />
      <Card><CardContent className="pt-6 space-y-4">
        <div className="grid gap-4 md:grid-cols-4 text-sm">
          <Info label={t("deliveries.driver")} value={d.driverName} />
          <Info label={t("deliveries.vehicle")} value={d.vehicleNo} />
          <Info
            label={t("sales.orderNo")}
            value={d.salesOrderId ? (
              <Link className="font-medium text-primary underline-offset-2 hover:underline" to="/sales/$id" params={{ id: d.salesOrderId }}>
                {d.salesOrderId}
              </Link>
            ) : "—"}
          />
          <Info label={t("common.date")} value={d.confirmedAt ? formatDateTime(d.confirmedAt) : "—"} />
        </div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t("sales.item")}</TableHead><TableHead className="text-right">{t("common.quantity")}</TableHead>
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
            {d.status === "pending" ? t("deliveries.confirm") : t(`status.${d.status}` as any)}
          </Button>
        </div>
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
