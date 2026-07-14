import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { purchaseService } from "@/services/purchase.service";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/common/PageHeader";
import type { PaymentMethod } from "@/types";
import { useT } from "@/i18n";

export function PurchaseView({ id }: { id: string }) {
  const t = useT();
  const qc = useQueryClient();
  const { data: po, isLoading, isFetched } = useQuery({
    queryKey: ["purchases", id],
    queryFn: () => purchaseService.get(id),
  });
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("bank");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["purchases"] });
    qc.invalidateQueries({ queryKey: ["purchases", id] });
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["stockMovements"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const receive = useMutation({
    mutationFn: () => purchaseService.receive(id),
    onSuccess: () => { invalidate(); toast.success(t("purchases.received")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const pay = useMutation({
    mutationFn: (n: number) => purchaseService.recordPayment(id, n, method),
    onSuccess: () => { invalidate(); toast.success(t("purchases.paymentRecorded")); setAmount(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: () => purchaseService.setStatus(id, "cancelled"),
    onSuccess: () => { invalidate(); toast.success(t("purchases.cancelled")); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">{t("common.loading")}</div>;
  if (isFetched && !po) return <div className="p-6 text-sm text-destructive">{t("purchases.notFound")}</div>;
  if (!po) return null;

  const due = po.total - po.paid;
  const busy = receive.isPending || pay.isPending || cancel.isPending;

  return (
    <div>
      <PageHeader
        title={`${t("purchases.title")} ${po.orderNo}`}
        description={`${po.supplierName} · ${formatDate(po.date)}`}
        backTo="/purchases"
        backLabel={t("purchases.title")}
        actions={
          <div className="flex items-center gap-2">
            {(po.status === "draft" || po.status === "ordered") && (
              <Button variant="outline" asChild>
                <Link to="/purchases/$id/edit" params={{ id: po.id }}>{t("common.edit")}</Link>
              </Button>
            )}
            <Badge>{t(`status.${po.status}` as any)}</Badge>
          </div>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2"><CardContent className="pt-6 space-y-4">
          {po.grnNo && <p className="text-sm text-muted-foreground">GRN: <span className="font-mono">{po.grnNo}</span></p>}
          <Table>
            <TableHeader><TableRow>
              <TableHead>{t("sales.item")}</TableHead><TableHead className="text-right">{t("common.quantity")}</TableHead>
              <TableHead className="text-right">{t("purchases.cost")}</TableHead><TableHead className="text-right">{t("common.total")}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {po.items.map((it, i) => (
                <TableRow key={i}>
                  <TableCell>{it.productName}</TableCell>
                  <TableCell className="text-right">{it.quantity}</TableCell>
                  <TableCell className="text-right">{formatCurrency(it.price)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(it.price * it.quantity * (1 + it.taxRate / 100))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex justify-end text-sm">
            <div className="w-56 space-y-1">
              <div className="flex justify-between"><span>{t("common.subtotal")}</span><span>{formatCurrency(po.subtotal)}</span></div>
              <div className="flex justify-between"><span>{t("common.tax")}</span><span>{formatCurrency(po.tax)}</span></div>
              <div className="flex justify-between border-t pt-1 font-semibold"><span>{t("common.total")}</span><span>{formatCurrency(po.total)}</span></div>
              <div className="flex justify-between"><span>{t("common.paid")}</span><span>{formatCurrency(po.paid)}</span></div>
              <div className="flex justify-between font-semibold"><span>{t("common.due")}</span><span>{formatCurrency(due)}</span></div>
            </div>
          </div>
        </CardContent></Card>

        <div className="space-y-4">
          <Card><CardContent className="pt-6 space-y-3">
            <h3 className="font-semibold">{t("sales.workflow")}</h3>
            {(po.status === "ordered" || po.status === "draft") && (
              <Button className="w-full" disabled={busy} onClick={() => receive.mutate()}>{t("purchases.receive")}</Button>
            )}
            {(po.status === "ordered" || po.status === "draft") && (
              <Button className="w-full" variant="destructive" disabled={busy} onClick={() => cancel.mutate()}>{t("purchases.cancel")}</Button>
            )}
            <p className="text-xs text-muted-foreground">{t("purchases.receiveHint")}</p>
          </CardContent></Card>

          <Card><CardContent className="pt-6 space-y-3">
            <h3 className="font-semibold">{t("purchases.supplierPayment")}</h3>
            <div className="space-y-1.5">
              <Label>{t("common.amount")}</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={due <= 0 || po.status === "cancelled"} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("purchases.paidFrom")}</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)} disabled={due <= 0}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{t("common.cash")}</SelectItem>
                  <SelectItem value="bank">{t("common.bank")}</SelectItem>
                  <SelectItem value="cheque">{t("common.cheque")}</SelectItem>
                  <SelectItem value="mobile">{t("common.mobileBanking")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              disabled={!amount || Number(amount) <= 0 || due <= 0 || pay.isPending || po.status === "cancelled"}
              onClick={() => pay.mutate(Number(amount))}
            >
              {due <= 0 ? t("sales.fullyPaid") : t("sales.recordPayment")}
            </Button>
          </CardContent></Card>
        </div>
      </div>
    </div>
  );
}
